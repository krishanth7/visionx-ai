import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelLoader:
    def __init__(self, model_path="model/ssd_mobilenet_v2.tflite"):
        self.model_path = model_path
        self.detector = None

    def load_model(self):
        """
        Loads the MediaPipe object detection model.
        """
        try:
            absolute_path = os.path.abspath(self.model_path)
            logger.info(f"Loading MediaPipe model from {absolute_path}...")
            
            base_options = python.BaseOptions(model_asset_path=absolute_path)
            options = vision.ObjectDetectorOptions(
                base_options=base_options,
                running_mode=vision.RunningMode.IMAGE,
                max_results=10,
                score_threshold=0.3
            )
            self.detector = vision.ObjectDetector.create_from_options(options)
            logger.info("MediaPipe detector created successfully.")
            
            return self.detector
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise e
