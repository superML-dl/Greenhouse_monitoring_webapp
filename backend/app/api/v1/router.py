from fastapi import APIRouter
from app.api.v1.endpoints.inference import router as inference_router

api_router = APIRouter()
api_router.include_router(inference_router, prefix="/inference", tags=["inference"])
