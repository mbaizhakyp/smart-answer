# Smart Answer - Blackboard Assistant

## Overview
Smart Answer is a Chrome Extension designed to assist students by identifying questions on Blackboard test pages, analyzing them using an LLM (OpenAI), and suggesting the most likely correct answer. It features a robust backend that utilizes fuzzy matching to ensure suggested answers correspond to the actual available options.

## Project Structure
- **/extension**: Contains the Manifest V3 Chrome Extension source code.
- **/backend**: Contains the Python FastAPI server that handles logic and AI communication.

## Prerequisites
- Python 3.8+
- OpenAI API Key
- Google Chrome (or Chromium-based browser)

## Setup
### Backend (Local)
1. Navigate to `/backend`.
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies: `pip install -r requirements.txt`.
4. Create a `.env` file in `backend/` with `OPENAI_API_KEY=your_key_here`.
5. Run the server: `uvicorn main:app --reload`.

### Backend (Docker)
1. Ensure you have Docker and Docker Compose installed.
2. Create a `.env` file in the project root with `OPENAI_API_KEY=your_key_here`.
3. Run the container:
   ```bash
   docker-compose up --build
   ```
4. The backend will be available at `http://localhost:8000`.

### Extension
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `/extension` folder from this repository.
