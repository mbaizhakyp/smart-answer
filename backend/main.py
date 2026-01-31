import os
import Levenshtein
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Smart Answer Backend")

# CORS Configuration
# allowing all origins for development convenience as the extension ID might change
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class QuestionRequest(BaseModel):
    question: str
    options: List[str]

class QuestionResponse(BaseModel):
    answer: str
    confidence: float
    raw_response: str
    matched_option: Optional[str] = None

def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def fuzzy_match(target: str, options: List[str]) -> tuple[Optional[str], float]:
    """
    Finds the best matching option for the target string using Levenshtein distance.
    Returns (best_match_option, confidence_score_0_to_1).
    """
    if not options:
        return None, 0.0

    best_match = None
    best_ratio = 0.0

    # Normalize target for better matching
    target_clean = target.strip().lower()

    for option in options:
        option_clean = option.strip().lower()
        # Levenshtein ratio: 0 (no match) to 1 (perfect match)
        ratio = Levenshtein.ratio(target_clean, option_clean)
        
        # Check for containment as a fallback (e.g. if LLM returns "The answer is A. Option Text")
        if option_clean in target_clean and len(option_clean) > 4:
            # Boost ratio if it's contained but ensure it's not a tiny substring
            ratio = max(ratio, 0.9)

        if ratio > best_ratio:
            best_ratio = ratio
            best_match = option

    return best_match, best_ratio

@app.post("/solve", response_model=QuestionResponse)
async def solve_question(request: QuestionRequest):
    client = get_openai_client()

    # Construct Prompt
    options_text = "\n".join([f"- {opt}" for opt in request.options])
    prompt = f"""You are an academic assistant. Analyze the following question and select the correct option from the provided list.
    
Question: {request.question}

Options:
{options_text}

Provide ONLY the content of the correct option. Do not explain.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # Using a capable model
            messages=[
                {"role": "system", "content": "You are a helpful and precise academic assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        
        raw_answer = response.choices[0].message.content.strip()
        
        # Fuzzy Match
        matched_option, confidence = fuzzy_match(raw_answer, request.options)

        # Decision threshold: if match is low, return raw, but indicate low confidence
        final_answer = matched_option if matched_option and confidence > 0.6 else raw_answer

        return QuestionResponse(
            answer=final_answer,
            confidence=confidence,
            raw_response=raw_answer,
            matched_option=matched_option
        )

    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}
