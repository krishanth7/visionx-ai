import cv2
import numpy as np
import mediapipe as mp
import logging

logger = logging.getLogger(__name__)

class ObjectDetector:
    def __init__(self, detector):
        self.detector = detector

    def process_frame(self, frame_bytes, threshold=0.5):
        """
        Process a single frame and return detections using MediaPipe.
        """
        # Decode image from bytes
        nparr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return []

        # Convert to RGB (MediaPipe expects RGB)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Create MediaPipe Image object
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

        # Run inference
        detection_result = self.detector.detect(mp_image)

        detections = []
        height, width, _ = img.shape

        for detection in detection_result.detections:
            # Force 100% confidence for display as requested
            score = 1.0 
            category = detection.categories[0]
            label = category.category_name
                
            bbox = detection.bounding_box
            
            # Normalize coordinates for the frontend to be resolution-independent
            detections.append({
                "label": label,
                "confidence": float(score),
                "box": {
                    "x": float(bbox.origin_x / width),
                    "y": float(bbox.origin_y / height),
                    "w": float(bbox.width / width),
                    "h": float(bbox.height / height)
                }
            })

        return detections
