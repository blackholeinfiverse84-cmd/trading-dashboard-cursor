"""
MCP-Style API Server for Stock Prediction - FastAPI Version
Exposes REST endpoints for ML predictions with dynamic risk parameters
OPEN ACCESS - No authentication required, with rate limiting and input validation
"""

import sys
import os

# Force unbuffered output so we can see prints immediately
sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', buffering=1)
sys.stderr = os.fdopen(sys.stderr.fileno(), 'w', buffering=1)

# Set environment variable for Python unbuffered output
os.environ['PYTHONUNBUFFERED'] = '1'

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
import logging
from pathlib import Path
from datetime import datetime
import json
import psutil

from auth import get_current_user, authenticate_user
from rate_limiter import check_rate_limit, get_rate_limit_status
from validators import (
    validate_symbols, validate_horizon, validate_horizons_list,
    validate_risk_parameters, sanitize_input, validate_confidence
)
import config
from config import LOGS_DIR, ENABLE_AUTH
from auth_routes import router as auth_router

# Initialize FastAPI app
app = FastAPI(
    title=config.API_TITLE,
    version=config.API_VERSION,
    description=config.API_DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Include authentication routes
app.include_router(auth_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging setup with automatic rotation
from logging.handlers import RotatingFileHandler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            str(LOGS_DIR / 'api_server.log'),  # Cross-platform path handling
            maxBytes=10*1024*1024,  # 10 MB per file (prevents huge log files)
            backupCount=5,           # Keep 5 backup files (max 60 MB total)
            encoding='utf-8'
        ),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize MCP Adapter
mcp_adapter = None

def get_mcp_adapter():
    """Lazy load MCP adapter on first use"""
    global mcp_adapter
    if mcp_adapter is None:
        try:
            from core.mcp_adapter import MCPAdapter
            mcp_adapter = MCPAdapter()
            logger.info("MCP Adapter initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MCP Adapter: {e}", exc_info=True)
            raise
    return mcp_adapter

# API request logging
API_LOG_PATH = Path("data/logs/api_requests.jsonl")
SECURITY_LOG_PATH = Path("data/logs/security.jsonl")


# ==================== Pydantic Models ====================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)

class PredictRequest(BaseModel):
    symbols: List[str] = Field(..., min_length=1, max_length=50)
    horizon: str = Field(default="intraday")
    risk_profile: Optional[str] = Field(None)
    stop_loss_pct: Optional[float] = Field(None, ge=0.1, le=50.0)
    capital_risk_pct: Optional[float] = Field(None, ge=0.1, le=100.0)
    drawdown_limit_pct: Optional[float] = Field(None, ge=0.1, le=100.0)
    
    @field_validator('symbols')
    @classmethod
    def validate_symbols_not_empty(cls, v):
        """Ensure symbols list is not empty and normalize to uppercase"""
        if not v or len(v) == 0:
            raise ValueError('At least one symbol must be provided')
        return [s.upper().strip() for s in v]
    
    @field_validator('horizon')
    @classmethod
    def validate_horizon_value(cls, v):
        """Validate horizon is one of the allowed values"""
        valid_horizons = ['intraday', 'short', 'long']
        if v.lower() not in valid_horizons:
            raise ValueError(f'Invalid horizon. Valid options: {", ".join(valid_horizons)}')
        return v.lower()
    
    @field_validator('risk_profile')
    @classmethod
    def validate_risk_profile_value(cls, v):
        """Validate risk profile if provided"""
        if v is not None:
            valid_profiles = ['low', 'moderate', 'high']
            if v.lower() not in valid_profiles:
                raise ValueError(f'Invalid risk_profile. Valid options: {", ".join(valid_profiles)}')
            return v.lower()
        return v


class ScanAllRequest(BaseModel):
    symbols: List[str] = Field(..., min_length=1, max_length=100)
    horizon: str = Field(default="intraday")
    min_confidence: float = Field(default=0.3, ge=0.0, le=1.0)
    stop_loss_pct: Optional[float] = Field(None, ge=0.1, le=50.0)
    capital_risk_pct: Optional[float] = Field(None, ge=0.1, le=100.0)
    
    @field_validator('symbols')
    @classmethod
    def validate_symbols_list(cls, v):
        """Ensure symbols list is not empty and normalize"""
        if not v or len(v) == 0:
            raise ValueError('At least one symbol must be provided')
        return [s.upper().strip() for s in v]
    
    @field_validator('horizon')
    @classmethod
    def validate_horizon_value(cls, v):
        """Validate horizon is one of the allowed values"""
        valid_horizons = ['intraday', 'short', 'long']
        if v.lower() not in valid_horizons:
            raise ValueError(f'Invalid horizon. Valid options: {", ".join(valid_horizons)}')
        return v.lower()


class AnalyzeRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    horizons: List[str] = Field(default=["intraday"], min_length=1, max_length=3)
    stop_loss_pct: float = Field(default=2.0, ge=0.1, le=50.0)
    capital_risk_pct: float = Field(default=1.0, ge=0.1, le=100.0)
    drawdown_limit_pct: float = Field(default=5.0, ge=0.1, le=100.0)
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol_format(cls, v):
        """Normalize symbol to uppercase and validate not empty"""
        if not v.strip():
            raise ValueError('Symbol cannot be empty')
        return v.upper().strip()
    
    @field_validator('horizons')
    @classmethod
    def validate_horizons_list(cls, v):
        """Validate each horizon and normalize"""
        if not v or len(v) == 0:
            raise ValueError('At least one horizon must be provided')
        valid_horizons = ['intraday', 'short', 'long']
        for h in v:
            if h.lower() not in valid_horizons:
                raise ValueError(f'Invalid horizon: {h}. Valid options: {", ".join(valid_horizons)}')
        return [h.lower() for h in v]


class FeedbackRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    predicted_action: str = Field(...)
    user_feedback: str = Field(...)
    actual_return: Optional[float] = Field(None, ge=-100.0, le=1000.0)
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol_format(cls, v):
        """Normalize symbol to uppercase"""
        return v.upper().strip()
    
    @field_validator('predicted_action')
    @classmethod
    def validate_and_normalize_action(cls, v):
        """Validate and normalize predicted action (accepts BUY/SELL and LONG/SHORT/HOLD)"""
        v_upper = v.upper().strip()
        # Map BUY/SELL to LONG/SHORT for internal processing
        action_mapping = {
            'BUY': 'LONG',
            'SELL': 'SHORT',
            'LONG': 'LONG',
            'SHORT': 'SHORT',
            'HOLD': 'HOLD'
        }
        if v_upper in action_mapping:
            return action_mapping[v_upper]
        valid_actions = ['LONG', 'SHORT', 'HOLD', 'BUY', 'SELL']
        raise ValueError(f'Invalid predicted_action. Valid options: {", ".join(valid_actions)}')
    
    @field_validator('user_feedback')
    @classmethod
    def validate_feedback(cls, v):
        """Validate user feedback (accepts free text or correct/incorrect)"""
        if not v or not v.strip():
            raise ValueError('user_feedback cannot be empty')
        # Accept any text feedback, but also support correct/incorrect for backward compatibility
        return v.strip()
    
    @field_validator('actual_return')
    @classmethod
    def validate_return_range(cls, v):
        """Validate actual return is within reasonable range"""
        if v is not None:
            # Check for NaN or Inf
            if v != v:  # NaN check
                raise ValueError('actual_return cannot be NaN')
            if abs(v) == float('inf'):
                raise ValueError('actual_return cannot be infinite')
        return v


class TrainRLRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    horizon: str = Field(default="intraday")
    n_episodes: int = Field(default=10, ge=10, le=100)
    force_retrain: bool = False
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol_format(cls, v):
        """Normalize symbol to uppercase"""
        return v.upper().strip()
    
    @field_validator('horizon')
    @classmethod
    def validate_horizon_value(cls, v):
        """Validate horizon is one of the allowed values"""
        valid_horizons = ['intraday', 'short', 'long']
        if v.lower() not in valid_horizons:
            raise ValueError(f'Invalid horizon. Valid options: {", ".join(valid_horizons)}')
        return v.lower()


class FetchDataRequest(BaseModel):
    symbols: List[str] = Field(..., min_length=1, max_length=100)
    period: str = Field(default="2y")
    include_features: bool = False
    refresh: bool = False
    
    @field_validator('symbols')
    @classmethod
    def validate_symbols_list(cls, v):
        """Ensure symbols list is not empty and normalize"""
        if not v or len(v) == 0:
            raise ValueError('At least one symbol must be provided')
        return [s.upper().strip() for s in v]
    
    @field_validator('period')
    @classmethod
    def validate_period_value(cls, v):
        """Validate period is one of the allowed values"""
        valid_periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']
        if v not in valid_periods:
            raise ValueError(f'Invalid period. Valid options: {", ".join(valid_periods)}')
        return v


# ==================== Utility Functions ====================

def log_api_request(endpoint: str, request_data: Dict, response_data: Dict, status_code: int):
    """Log API request and response with detailed information"""
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'endpoint': endpoint,
        'method': 'POST',
        'request': request_data,
        'response_summary': {
            'status_code': status_code,
            'has_predictions': 'predictions' in response_data,
            'prediction_count': response_data.get('metadata', {}).get('count', 0) if 'metadata' in response_data else 0
        },
        'status_code': status_code
    }
    
    API_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with open(API_LOG_PATH, 'a') as f:
        f.write(json.dumps(log_entry, default=str) + '\n')


def log_security_event(request: Request, event_type: str, details: Dict):
    """Log security-related events"""
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'event_type': event_type,
        'client_ip': request.client.host if request.client else 'unknown',
        'endpoint': request.url.path,
        'details': details
    }
    
    SECURITY_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with open(SECURITY_LOG_PATH, 'a') as f:
        f.write(json.dumps(log_entry, default=str) + '\n')


# ==================== Exception Handlers ====================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            'error': str(exc),
            'type': type(exc).__name__
        }
    )


# ==================== API Routes ====================

@app.get("/")
async def index():
    """API information"""
    auth_status = "enabled" if ENABLE_AUTH else "disabled"
    return {
        'name': 'Blackhole Infeverse Trading API',
        'version': '4.0',
        'description': 'MCP-style REST API with configurable authentication, rate limiting, and validation for Blackhole Infeverse Trading',
        'authentication': f'{auth_status.upper()} - {"Login required" if ENABLE_AUTH else "Open access to all endpoints"}',
        'auth_status': auth_status,
        'endpoints': {
            '/': 'GET - API information',
            '/auth/login': 'POST - Login (if auth enabled)',
            '/auth/status': 'GET - Check rate limit status',
            '/tools/health': 'GET - System health',
            '/tools/predict': f'POST - Generate predictions ({"AUTH REQUIRED" if ENABLE_AUTH else "NO AUTH"})',
            '/tools/scan_all': f'POST - Scan and rank symbols ({"AUTH REQUIRED" if ENABLE_AUTH else "NO AUTH"})',
            '/tools/analyze': f'POST - Analyze with risk parameters ({"AUTH REQUIRED" if ENABLE_AUTH else "NO AUTH"})',
            '/tools/feedback': f'POST - Provide feedback ({"AUTH REQUIRED" if ENABLE_AUTH else "NO AUTH"})',
            '/tools/train_rl': f'POST - Train RL agent ({"AUTH REQUIRED" if ENABLE_AUTH else "NO AUTH"})',
            '/tools/fetch_data': f'POST - Fetch batch data ({"AUTH REQUIRED" if ENABLE_AUTH else "NO AUTH"})'
        },
        'rate_limits': {
            'per_minute': config.RATE_LIMIT_PER_MINUTE,
            'per_hour': config.RATE_LIMIT_PER_HOUR
        },
        'documentation': {
            'swagger_ui': '/docs',
            'redoc': '/redoc'
        }
    }


@app.post("/auth/login")
async def login(login_data: LoginRequest):
    """Login endpoint - only available if authentication is enabled"""
    if not ENABLE_AUTH:
        # If auth is disabled, return success with no-auth token
        return {
            'success': True,
            'username': login_data.username or 'anonymous',
            'token': 'no-auth-required',
            'message': 'Authentication is disabled - open access mode'
        }
    
    try:
        result = authenticate_user(login_data.username, login_data.password)
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=401, detail=result['error'])
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/auth/status")
async def auth_status(request: Request):
    """Get rate limit status for current IP"""
    try:
        status = get_rate_limit_status(request=request)
        return status
    except Exception as e:
        logger.error(f"Status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tools/health")
async def health_check():
    """System health and resource usage"""
    try:
        # Use non-blocking CPU check (interval=0 or None for instant check)
        cpu_percent = psutil.cpu_percent(interval=0.1)  # 100ms instead of 1 second
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('.')
        
        health_data = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'system': {
                'cpu_usage_percent': cpu_percent,
                'memory_total_gb': round(memory.total / (1024**3), 2),
                'memory_used_gb': round(memory.used / (1024**3), 2),
                'memory_available_gb': round(memory.available / (1024**3), 2),
                'memory_percent': memory.percent,
                'disk_total_gb': round(disk.total / (1024**3), 2),
                'disk_used_gb': round(disk.used / (1024**3), 2),
                'disk_free_gb': round(disk.free / (1024**3), 2),
                'disk_percent': disk.percent
            },
            'models': {
                'available': True,
                'total_trained': len(list(Path('models').glob('*.pkl')))
            }
        }
        
        return health_data
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@app.post("/tools/predict")
async def predict(
    request: Request,
    predict_data: PredictRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Generate predictions for symbols"""
    try:
        data = predict_data.dict()
        data = sanitize_input(data)
        
        validation = validate_symbols(data['symbols'])
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        if not validate_horizon(data['horizon']):
            raise HTTPException(status_code=400, detail='Invalid horizon. Valid options: intraday, short, long')
        
        result = get_mcp_adapter().predict(
            symbols=data['symbols'],
            horizon=data['horizon'],
            risk_profile=data.get('risk_profile')
        )
        
        log_api_request('/tools/predict', data, result, 200)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        error_response = {'error': str(e)}
        log_api_request('/tools/predict', predict_data.dict(), error_response, 500)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/scan_all")
async def scan_all(
    request: Request,
    scan_data: ScanAllRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Scan and rank multiple symbols"""
    try:
        data = scan_data.dict()
        data = sanitize_input(data)
        
        validation = validate_symbols(data['symbols'], config.MAX_SCAN_SYMBOLS)
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        if not validate_horizon(data['horizon']):
            raise HTTPException(status_code=400, detail='Invalid horizon. Valid options: intraday, short, long')
        
        if not validate_confidence(data['min_confidence']):
            raise HTTPException(status_code=400, detail='min_confidence must be between 0.0 and 1.0')
        
        result = get_mcp_adapter().scan_all(
            symbols=data['symbols'],
            horizon=data['horizon'],
            min_confidence=data['min_confidence'],
            stop_loss_pct=data.get('stop_loss_pct'),
            capital_risk_pct=data.get('capital_risk_pct')
        )
        
        log_api_request('/tools/scan_all', data, result, 200)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scan error: {e}", exc_info=True)
        error_response = {'error': str(e)}
        log_api_request('/tools/scan_all', scan_data.dict(), error_response, 500)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/analyze")
async def analyze(
    request: Request,
    analyze_data: AnalyzeRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Analyze custom tickers with risk parameters"""
    try:
        data = analyze_data.dict()
        data = sanitize_input(data)
        
        validation = validate_symbols([data['symbol']])
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        horizons_validation = validate_horizons_list(data['horizons'])
        if not horizons_validation['valid']:
            raise HTTPException(status_code=400, detail=horizons_validation['error'])
        
        risk_validation = validate_risk_parameters(
            data['stop_loss_pct'], 
            data['capital_risk_pct'], 
            data['drawdown_limit_pct']
        )
        if not risk_validation['valid']:
            raise HTTPException(status_code=400, detail=risk_validation['error'])
        
        result = get_mcp_adapter().analyze(
            symbol=data['symbol'],
            horizons=data['horizons'],
            stop_loss_pct=data['stop_loss_pct'],
            capital_risk_pct=data['capital_risk_pct'],
            drawdown_limit_pct=data['drawdown_limit_pct']
        )
        
        log_api_request('/tools/analyze', data, result, 200)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        error_response = {'error': str(e)}
        log_api_request('/tools/analyze', analyze_data.dict(), error_response, 500)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/feedback")
async def feedback(
    request: Request,
    feedback_data: FeedbackRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Process user feedback for RL fine-tuning"""
    try:
        data = feedback_data.dict()
        data = sanitize_input(data)
        
        validation = validate_symbols([data['symbol']])
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        # Normalize action: BUY -> LONG, SELL -> SHORT
        action_mapping = {
            'BUY': 'LONG',
            'SELL': 'SHORT',
            'LONG': 'LONG',
            'SHORT': 'SHORT',
            'HOLD': 'HOLD'
        }
        normalized_action = action_mapping.get(data['predicted_action'].upper())
        if not normalized_action:
            valid_actions = ['LONG', 'SHORT', 'HOLD', 'BUY', 'SELL']
            raise HTTPException(status_code=400, detail=f'Invalid predicted_action. Valid: {", ".join(valid_actions)}')
        
        # Store original action for logging, but use normalized for processing
        original_action = data['predicted_action']
        user_feedback_text = data['user_feedback']
        
        # Determine if feedback is correct/incorrect based on text or explicit value
        # If user provides "correct" or "incorrect", use that; otherwise analyze the text
        feedback_lower = user_feedback_text.lower().strip()
        if feedback_lower in ['correct', 'incorrect']:
            feedback_sentiment = feedback_lower
        else:
            # Analyze text to determine sentiment (simple keyword-based)
            negative_keywords = ['wrong', 'incorrect', 'bad', 'failed', 'reversed', 'loss', 'down', 'fell', 'dropped']
            positive_keywords = ['correct', 'right', 'good', 'worked', 'profit', 'up', 'rose', 'gained']
            
            has_negative = any(keyword in feedback_lower for keyword in negative_keywords)
            has_positive = any(keyword in feedback_lower for keyword in positive_keywords)
            
            if has_negative and not has_positive:
                feedback_sentiment = 'incorrect'
            elif has_positive and not has_negative:
                feedback_sentiment = 'correct'
            else:
                # Default to incorrect if ambiguous (conservative approach)
                feedback_sentiment = 'incorrect'
        
        result = get_mcp_adapter().process_feedback(
            symbol=data['symbol'],
            predicted_action=normalized_action,  # Use normalized LONG/SHORT/HOLD
            user_feedback=feedback_sentiment,  # Use correct/incorrect for RL training
            actual_return=data.get('actual_return')
        )
        
        # Include original feedback text in response
        result['original_feedback_text'] = user_feedback_text
        result['original_action'] = original_action
        
        # Return 400 if feedback was rejected due to validation error
        if result.get('status') == 'error':
            log_api_request('/tools/feedback', data, result, 400)
            raise HTTPException(
                status_code=400,
                detail={
                    'error': result.get('error', 'Feedback validation failed'),
                    'validation_warning': result.get('validation_warning'),
                    'suggested_feedback': result.get('suggested_feedback')
                }
            )
        
        log_api_request('/tools/feedback', data, result, 200)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Feedback error: {e}", exc_info=True)
        error_response = {'error': str(e)}
        log_api_request('/tools/feedback', feedback_data.dict(), error_response, 500)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/train_rl")
async def train_rl(
    request: Request,
    train_data: TrainRLRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Train RL agent and return reward statistics"""
    try:
        data = train_data.dict()
        data = sanitize_input(data)
        
        validation = validate_symbols([data['symbol']])
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        if not validate_horizon(data['horizon']):
            raise HTTPException(status_code=400, detail='Invalid horizon. Valid options: intraday, short, long')
        
        try:
            n_episodes = int(data['n_episodes'])
            if not (10 <= n_episodes <= 100):
                raise HTTPException(status_code=400, detail='n_episodes must be between 10 and 100')
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail='n_episodes must be an integer')
        
        result = get_mcp_adapter().train_rl(
            symbol=data['symbol'],
            horizon=data['horizon'],
            n_episodes=n_episodes,
            force_retrain=data['force_retrain']
        )
        
        log_api_request('/tools/train_rl', data, result, 200)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RL training error: {e}", exc_info=True)
        error_response = {'error': str(e)}
        log_api_request('/tools/train_rl', train_data.dict(), error_response, 500)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/fetch_data")
async def fetch_data(
    request: Request,
    fetch_data_req: FetchDataRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Fetch batch data for symbols"""
    try:
        data = fetch_data_req.dict()
        data = sanitize_input(data)
        
        validation = validate_symbols(data['symbols'], config.MAX_SCAN_SYMBOLS)
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        valid_periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']
        if data['period'] not in valid_periods:
            raise HTTPException(status_code=400, detail=f'Invalid period. Valid options: {", ".join(valid_periods)}')
        
        result = get_mcp_adapter().fetch_data(
            symbols=data['symbols'],
            period=data['period'],
            include_features=data['include_features'],
            refresh=data['refresh']
        )
        
        log_api_request('/tools/fetch_data', data, result, 200)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fetch data error: {e}", exc_info=True)
        error_response = {'error': str(e)}
        log_api_request('/tools/fetch_data', fetch_data_req.dict(), error_response, 500)
        raise HTTPException(status_code=500, detail=str(e))



# ==================== Risk Management API ====================

class StopLossRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    stop_loss_price: float = Field(..., gt=0)
    side: str = Field(..., pattern=r'^(BUY|SELL)$')
    timeframe: str = Field(default='1d')
    source: str = Field(default='manual', pattern=r'^(chart|manual)$')
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol_format(cls, v):
        """Normalize symbol to uppercase"""
        return v.upper().strip()


class RiskAssessmentRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    entry_price: float = Field(..., gt=0)
    stop_loss_price: float = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    capital_at_risk: float = Field(default=0.02, gt=0, le=1)  # Default 2% risk
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol_format(cls, v):
        """Normalize symbol to uppercase"""
        return v.upper().strip()


@app.post('/api/risk/stop-loss')
async def set_stop_loss(
    request: Request,
    stop_loss_data: StopLossRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Set or update stop-loss for a symbol"""
    try:
        data = stop_loss_data.dict()
        data = sanitize_input(data)
        
        # Validate symbol
        validation = validate_symbols([data['symbol']])
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        # Validate side
        if data['side'] not in ['BUY', 'SELL']:
            raise HTTPException(status_code=400, detail="side must be 'BUY' or 'SELL'")
        
        # Validate timeframe
        valid_timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1mo']
        if data['timeframe'] not in valid_timeframes:
            raise HTTPException(status_code=400, detail=f"timeframe must be one of: {', '.join(valid_timeframes)}")
        
        # Validate source
        if data['source'] not in ['chart', 'manual']:
            raise HTTPException(status_code=400, detail="source must be 'chart' or 'manual'")
        
        # Simulate setting stop loss (in real implementation, this would store in database)
        result = {
            'success': True,
            'message': f'Stop loss set for {data["symbol"]} at {data["stop_loss_price"]}',
            'stop_loss': {
                'symbol': data['symbol'],
                'price': data['stop_loss_price'],
                'side': data['side'],
                'timeframe': data['timeframe'],
                'source': data['source'],
                'timestamp': datetime.now().isoformat()
            }
        }
        
        logger.info(f"Stop loss set for {data['symbol']} at {data['stop_loss_price']}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stop loss error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



@app.post('/api/risk/assess')
async def assess_risk(
    request: Request,
    risk_data: RiskAssessmentRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """Assess risk for a position"""
    try:
        data = risk_data.dict()
        data = sanitize_input(data)
        
        # Validate symbol
        validation = validate_symbols([data['symbol']])
        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])
        
        # Calculate risk metrics
        entry_price = data['entry_price']
        stop_loss_price = data['stop_loss_price']
        quantity = data['quantity']
        
        # Calculate position size and risk
        position_size = entry_price * quantity
        risk_amount = abs(entry_price - stop_loss_price) * quantity
        risk_percentage = (risk_amount / position_size) * 100 if position_size > 0 else 0
        
        # Calculate max drawdown potential
        max_capital_at_risk = position_size * data['capital_at_risk']
        
        result = {
            'symbol': data['symbol'],
            'position_size': position_size,
            'risk_amount': risk_amount,
            'risk_percentage': risk_percentage,
            'capital_at_risk': data['capital_at_risk'],
            'max_capital_at_risk': max_capital_at_risk,
            'recommendation': 'ACCEPTABLE' if risk_percentage <= 5 else 'HIGH_RISK',
            'suggestions': []
        }
        
        if risk_percentage > 5:
            result['suggestions'].append('Consider reducing position size to lower risk')
        if risk_percentage > 10:
            result['suggestions'].append('Risk level is very high, strongly recommend reducing exposure')
        
        logger.info(f"Risk assessment completed for {data['symbol']}: {risk_percentage:.2f}% risk")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Risk assessment error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Trade Execution API ====================

class TradeExecutionRequest(BaseModel):
    """Request model for trade execution"""
    symbol: str = Field(..., min_length=1, max_length=20)
    quantity: int = Field(..., gt=0)
    entry_price: float = Field(..., gt=0)
    stop_loss_price: float = Field(..., gt=0)
    side: str = Field(..., pattern=r'^(BUY|SELL)$')
    order_type: str = Field(default='market', pattern=r'^(market|limit)$')
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol_format(cls, v):
        """Normalize symbol to uppercase"""
        return v.upper().strip()


@app.post('/tools/execute')
async def execute_trade(
    data: TradeExecutionRequest,
    request: Request,
    rate_limit_info: Dict = Depends(check_rate_limit)
):
    """Execute a trade order with validated risk parameters"""
    try:
        # Validate input
        data_dict = data.model_dump()
        symbol = data_dict['symbol']
        quantity = data_dict['quantity']
        entry_price = data_dict['entry_price']
        stop_loss_price = data_dict['stop_loss_price']
        side = data_dict['side']
        order_type = data_dict['order_type']
        
        # Validate symbol format
        validate_symbols([symbol])
        
        # Calculate position metrics
        position_size = entry_price * quantity
        risk_amount = abs(entry_price - stop_loss_price) * quantity
        risk_percentage = (risk_amount / position_size) * 100 if position_size > 0 else 0
        
        # Validate trade parameters
        if side not in ['BUY', 'SELL']:
            raise ValueError("Side must be BUY or SELL")
        
        if order_type not in ['market', 'limit']:
            raise ValueError("Order type must be market or limit")
        
        # Check if risk is within acceptable limits (> 20% is too risky)
        if risk_percentage > 20:
            raise ValueError(f"Risk is too high: {risk_percentage:.2f}%. Cannot execute trade.")
        
        # Generate order ID (simulated)
        import uuid
        order_id = str(uuid.uuid4())[:8].upper()
        
        # Simulate order execution (in production, this would connect to a broker)
        execution_time = datetime.now().isoformat()
        
        result = {
            'success': True,
            'order_id': order_id,
            'symbol': symbol,
            'side': side,
            'quantity': quantity,
            'entry_price': entry_price,
            'stop_loss_price': stop_loss_price,
            'execution_price': entry_price,  # In real scenario, actual filled price
            'position_size': position_size,
            'risk_amount': risk_amount,
            'risk_percentage': risk_percentage,
            'order_type': order_type,
            'timestamp': execution_time,
            'status': 'executed',
            'message': f'Trade order {order_id} executed successfully'
        }
        
        # Log the trade execution
        logger.info(f"Trade executed: {symbol} {side} {quantity} @ ₹{entry_price} (Risk: {risk_percentage:.2f}%)")
        log_api_request('/tools/execute', data_dict, result, 200)
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Trade execution validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Trade execution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI Chat API ====================

class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


@app.post('/api/ai/chat')
async def ai_chat(
    request: Request,
    chat_data: AIChatRequest,
    client_ip: str = Depends(check_rate_limit),
    current_user: dict = Depends(get_current_user)
):
    """AI chat assistant for trading advice"""
    try:
        data = chat_data.dict()
        data = sanitize_input(data)
        
        # Validate message length
        if len(data['message']) < 1:
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        # Simple AI response generation (in real implementation, this would use an LLM)
        message_lower = data['message'].lower()
        response_message = "I'm your AI trading assistant. I can help you analyze markets, explain predictions, and answer trading questions."
        
        if any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
            response_message = "Hello! How can I assist you with your trading today?"
        elif any(word in message_lower for word in ['help', 'assist', 'support']):
            response_message = "I can help you with market analysis, trading strategies, risk management, and explaining predictions."
        elif any(word in message_lower for word in ['market', 'trend', 'analysis']):
            response_message = "Based on current market conditions, I recommend reviewing technical indicators and monitoring volatility. Consider using our market scan feature for comprehensive analysis."
        elif any(word in message_lower for word in ['risk', 'stop loss', 'position']):
            response_message = "For risk management, I recommend setting stop losses at 2-3% for intraday trades and 5-8% for swing trades. Never risk more than 1-2% of your capital per trade."
        elif any(word in message_lower for word in ['prediction', 'forecast', 'future']):
            response_message = "Our AI models analyze multiple factors including technical indicators, market sentiment, and historical patterns. Remember that all predictions carry uncertainty and should be combined with proper risk management."
        elif any(word in message_lower for word in ['strategy', 'trade', 'buy', 'sell']):
            response_message = "Successful trading requires a combination of technical analysis, risk management, and emotional discipline. Consider using our tools to backtest strategies before implementing them."
        else:
            response_message = f"Thank you for your question about '{data['message'][:50]}...'. I'm here to help with trading insights, market analysis, and risk management advice."
        
        result = {
            'message': response_message,
            'timestamp': datetime.now().isoformat(),
            'context': data.get('context', {}),
            'intent': 'trading_assistance'
        }
        
        logger.info(f"AI chat response generated for query: {data['message'][:30]}...")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



# ==================== Main ====================

if __name__ == '__main__':
    import uvicorn
    import socket
    import time
    
    # Check if port is already in use and kill the process
    port = config.UVICORN_PORT
    host = config.UVICORN_HOST
    
    try:
        # Check if port is in use
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex((host, port))
        sock.close()
        
        if result == 0:  # Port is in use
            print(f"\n[WARNING] Port {port} is already in use!")
            print("[INFO] Attempting to find and kill the process...")
            
            try:
                # Find process using the port
                for conn in psutil.net_connections(kind='inet'):
                    if hasattr(conn, 'laddr') and conn.laddr and hasattr(conn.laddr, 'port') and conn.laddr.port == port and conn.status == psutil.CONN_LISTEN:
                        pid = conn.pid
                        if pid:
                            print(f"[INFO] Found process {pid} using port {port}. Killing it...")
                            try:
                                proc = psutil.Process(pid)
                                proc.terminate()
                                try:
                                    proc.wait(timeout=3)
                                    print(f"[OK] Process {pid} terminated gracefully")
                                except psutil.TimeoutExpired:
                                    proc.kill()
                                    print(f"[OK] Process {pid} force killed")
                                time.sleep(2)  # Wait for port to be released
                                break
                            except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                                print(f"[WARNING] Could not kill process {pid}: {e}")
                                print(f"[ERROR] Please manually kill the process using port {port}")
                                print(f"       Run: taskkill /F /PID {pid}")
                                sys.exit(1)
            except Exception as e:
                print(f"[ERROR] Could not automatically free port {port}: {e}")
                print(f"[ERROR] Please manually stop the process using port {port}")
                print(f"       Or run: backend\\KILL_PORT_8000.bat")
                sys.exit(1)
    except Exception as e:
        print(f"[WARNING] Could not check port status: {e}")
        print("[INFO] Continuing anyway...")
    
    print("\n" + "="*80)
    print(" " * 15 + "BLACKHOLE INFEVERSE TRADING API SERVER STARTING")
    print("="*80)
    print("\nSECURITY FEATURES:")
    if ENABLE_AUTH:
        print("  [X] JWT Authentication: ENABLED")
        print(f"      Admin Username: {config.ADMIN_USERNAME}")
        print(f"      Token Expiration: {config.JWT_EXPIRATION_HOURS} hours")
    else:
        print("  [ ] JWT Authentication: DISABLED (Open Access)")
    # Reload config to ensure we get latest values (especially rate limits from env vars)
    import importlib
    if 'config' in sys.modules:
        importlib.reload(sys.modules['config'])
        # Re-import after reload to get updated values
        import config
    print(f"  [X] Rate Limiting ({config.RATE_LIMIT_PER_MINUTE}/min, {config.RATE_LIMIT_PER_HOUR}/hour)")
    print("  [X] Input Validation")
    print("  [X] Comprehensive Logging")
    print("\nFRAMEWORK:")
    print("  [X] FastAPI (Modern, Fast, Async)")
    print("  [X] Automatic OpenAPI Documentation")
    print("  [X] Pydantic Data Validation")
    print("\nENDPOINTS:")
    auth_label = "AUTH REQUIRED" if ENABLE_AUTH else "OPEN ACCESS"
    print(f"  GET  /                - API information")
    if ENABLE_AUTH:
        print(f"  POST /auth/login      - User authentication")
    print(f"  GET  /auth/status     - Rate limit status")
    print(f"  GET  /tools/health    - System health")
    print(f"  POST /tools/predict   - Generate predictions ({auth_label})")
    print(f"  POST /tools/scan_all  - Scan and rank symbols ({auth_label})")
    print(f"  POST /tools/analyze   - Analyze with risk parameters ({auth_label})")
    print(f"  POST /tools/feedback  - Human feedback ({auth_label})")
    print(f"  POST /tools/train_rl  - Train RL agent ({auth_label})")
    print(f"  POST /tools/fetch_data - Fetch batch data ({auth_label})")
    print(f"  POST /api/risk/stop-loss - Set stop loss ({auth_label})")
    print(f"  POST /api/risk/assess - Assess risk ({auth_label})")
    print(f"  POST /tools/execute   - Execute trade ({auth_label})")
    print(f"  POST /api/ai/chat - AI trading assistant ({auth_label})")
    print("\nDOCUMENTATION:")
    print(f"  Swagger UI: http://{config.UVICORN_HOST}:{config.UVICORN_PORT}/docs")
    print(f"  ReDoc: http://{config.UVICORN_HOST}:{config.UVICORN_PORT}/redoc")
    print("\nACCESS MODE:")
    if ENABLE_AUTH:
        print("  Status: AUTHENTICATION ENABLED")
        print("  Login required for all endpoints")
        print(f"  Admin credentials: {config.ADMIN_USERNAME} / {config.ADMIN_PASSWORD}")
    else:
        print("  Status: OPEN ACCESS")
        print("  Authentication: None required")
        print("  All endpoints available without login")
    print(f"\nServer starting on http://{config.UVICORN_HOST}:{config.UVICORN_PORT}")
    print("="*80 + "\n")
    
    # Security warning for debug mode
    if config.DEBUG_MODE:
        print("!" * 80)
        print(" WARNING: DEBUG MODE IS ENABLED ".center(80, "!"))
        print("!" * 80)
        print(" Debug mode exposes sensitive information!".center(80))
        print(" NEVER use debug mode in production deployments!".center(80))
        print(" Set DEBUG_MODE=False in .env for production".center(80))
        print("!" * 80 + "\n")
        import time
        time.sleep(2)  # Force admin to see warning
    
    uvicorn.run(
        "api_server:app",
        host=config.UVICORN_HOST,
        port=config.UVICORN_PORT,
        reload=config.DEBUG_MODE,
        log_level="info"
    )
