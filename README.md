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
### Backend
1. Navigate to `/backend`.
2. Install dependencies: `pip install -r requirements.txt`.
3. Create a `.env` file with `OPENAI_API_KEY=your_key_here`.
4. Run the server: `uvicorn main:app --reload`.

### Extension
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `/extension` folder from this repository.
