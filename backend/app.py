from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from .model_loader import ModelLoader
from .detector import ObjectDetector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Get the absolute path to the frontend directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Global instances for model and detector
model_loader = ModelLoader()
model = None
detector = None

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model on startup
    global model, detector
    try:
        model = model_loader.load_model()
        detector = ObjectDetector(model)
        logger.info("Application started and model initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize model on startup: {e}")
    yield
    # Clean up on shutdown if needed
    model = None
    detector = None

app = FastAPI(title="VisionX AI Backend", lifespan=lifespan)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend files
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
async def root():
    # Serve the index.html file directly at the root URL
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/health")
async def health_check():
    return {"status": "ready" if detector is not None else "initializing"}

@app.post("/predict")
async def predict(file: UploadFile = File(...), threshold: float = Form(0.5)):
    if detector is None:
        return {"error": "Model not loaded yet"}, 503
    
    try:
        contents = await file.read()
        detections = detector.process_frame(contents, threshold=threshold)
        return {"detections": detections}
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return {"error": str(e)}, 500

if __name__ == "__main__":
    print("\n" + "="*50)
    print("🚀 VISIONX IS READY")
    print("👉 CLICK THIS LINK: http://localhost:8000")
    print("="*50 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)
