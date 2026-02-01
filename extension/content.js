// Smart Answer Content Script (Stealth Mode)

console.log("Smart Answer: Stealth mode engaged.");

const BACKEND_URL = "http://localhost:8000/solve";

/**
 * Main initialization.
 * Uses MutationObserver to handle dynamic loading (AJAX/SPAs).
 */
function init() {
    // Initial scan
    scanAndAutoSolve();

    // Observe for changes
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            scanAndAutoSolve();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Scans for questions and automatically attempts to solve them.
 */
function scanAndAutoSolve() {
    // Selectors for Blackboard question containers
    const questionContainers = document.querySelectorAll('.takeQuestionDiv:not([data-smart-answer-processed="true"]), .stepcontent:not([data-smart-answer-processed="true"])');

    questionContainers.forEach(container => {
        container.setAttribute('data-smart-answer-processed', 'true');
        processQuestion(container);
    });
}

/**
 * Scrapes, solves, and selects the answer for a single question.
 */
async function processQuestion(container) {
    // 1. Scrape
    const { question, options } = scrapeQuestionData(container);

    if (!question || options.length === 0) {
        // console.log("Skipping container: insufficient data");
        return;
    }

    // 2. Solve (Backend)
    try {
        // console.log("Solving:", question.substring(0, 30) + "...");
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question, options })
        });

        if (!response.ok) {
            throw new Error(`Server status ${response.status}`);
        }

        const data = await response.json();

        // 3. Action (Stealth Select)
        if (data.matched_option && data.confidence > 0.6) {
            selectAnswer(container, data.matched_option);
            console.log("Solved and selected:", data.matched_option);
        } else {
            console.log("Low confidence or no match:", data);
        }

    } catch (err) {
        console.error("Smart Answer Error:", err);
    }
}

/**
 * Scrapes question text and options.
 */
function scrapeQuestionData(container) {
    // 1. Get Question Text
    let questionText = "";
    const qTextEl = container.querySelector('.vtbegenerated, .legend-visible, .questionText');
    if (qTextEl) {
        questionText = qTextEl.innerText;
    } else {
        questionText = container.innerText.split('\n')[0];
    }

    // 2. Get Options
    const options = [];

    // Look for labels
    const labels = container.querySelectorAll('label');
    if (labels.length > 0) {
        labels.forEach(label => {
            options.push(label.innerText.trim());
        });
    } else {
        // Fallback for tables: grab text near inputs
        const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        inputs.forEach(input => {
            const parent = input.parentElement;
            if (parent) {
                const text = parent.innerText.trim();
                // Filter out non-label text if possible, but for fuzzy matching getting parent text is usually fine
                if (text) options.push(text);
            }
        });
    }

    return {
        question: questionText.trim(),
        options: options.filter(o => o.length > 0)
    };
}

/**
 * Selects the input element corresponding to the matched answer string.
 */
function selectAnswer(container, matchedOption) {
    // 1. Try Labels: Find label with exact or partial match
    // matchedOption logic in backend ensures it's one of the options sent, but scrubbing might happen
    const labels = container.querySelectorAll('label');

    for (let label of labels) {
        if (label.innerText.includes(matchedOption) || matchedOption.includes(label.innerText)) {
            // Found the label. Now find the input associated with it.
            // Explicit "for" attribute?
            const forId = label.getAttribute('for');
            if (forId) {
                const input = document.getElementById(forId);
                if (input) {
                    clickInput(input);
                    return;
                }
            }
            // Implicit nesting?
            const nestedInput = label.querySelector('input');
            if (nestedInput) {
                clickInput(nestedInput);
                return;
            }
            // Sibling/Parent relationship? (less common for valid HTML5 but possible in legacy)
        }
    }

    // 2. Fallback: Inputs in tables/divs without formal labels
    // We already know the options came from somewhere.
    // Let's iterate inputs and check their parent/sibling text again (mirroring scrape logic)
    const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (let input of inputs) {
        const parent = input.parentElement;
        if (parent && (parent.innerText.includes(matchedOption) || matchedOption.includes(parent.innerText))) {
            clickInput(input);
            return;
        }
        // Check next sibling (td > input + text)
        const sibling = input.nextSibling;
        if (sibling && sibling.nodeValue && sibling.nodeValue.includes(matchedOption)) {
            clickInput(input);
            return;
        }
    }
}

/**
 * Safely clicks an input element.
 */
function clickInput(input) {
    if (!input) return;

    // Some sites listen for click, some for change. Do both.
    if (!input.checked) {
        input.click(); // Native click usually handles checked state and events
        input.checked = true; // Force it just in case

        // Dispatch explicit change event if click didn't trigger validation
        const event = new Event('change', { bubbles: true });
        input.dispatchEvent(event);
    }
}

// Start
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
