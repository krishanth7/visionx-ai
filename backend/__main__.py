import uvicorn
from .app import app

if __name__ == "__main__":
    print("\n" + "="*50)
    print("🚀 VISIONX IS READY (via -m backend)")
    print("👉 CLICK THIS LINK: http://127.0.0.1:8000")
    print("="*50 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)
