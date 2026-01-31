// Smart Answer Content Script

console.log("Smart Answer: Content script loaded.");

const BACKEND_URL = "http://localhost:8000/solve";

/**
 * Main initialization.
 * Uses MutationObserver to handle dynamic loading (AJAX/SPAs).
 */
function init() {
    // Initial scan
    scanAndInject();

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
            scanAndInject();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Scans the DOM for potential question containers and injects the "Solve" button.
 * Target selectors tailored for common Blackboard DOM structures.
 */
function scanAndInject() {
    // Blackboard often puts questions in containers like .takeQuestionDiv or .steptwo
    // The specific selector depends on the Blackboard version.
    // Common: .takeQuestionDiv, .vtbegenerated
    // We will look for containers that have question text and haven't been processed yet.

    // Heuristic: Look for elements that look like question containers
    // A good generic target for Blackboard is often an `li` in a `ul` list of questions
    // or `div.takeQuestionDiv`

    const questionContainers = document.querySelectorAll('.takeQuestionDiv:not([data-smart-answer-processed="true"]), .stepcontent:not([data-smart-answer-processed="true"])');

    questionContainers.forEach(container => {
        container.setAttribute('data-smart-answer-processed', 'true');
        injectSolveButton(container);
    });
}

/**
 * Injects the "Solve" button into a question container.
 * @param {HTMLElement} container - The DOM element containing a single question.
 */
function injectSolveButton(container) {
    const btn = document.createElement('button');
    btn.innerText = "✨ Solve";
    btn.className = "smart-answer-btn";

    // Find a good place to insert. Usually near the top or near points.
    // Try to find the points div or just append to top.
    const pointsDiv = container.querySelector('.points');
    if (pointsDiv) {
        pointsDiv.parentNode.insertBefore(btn, pointsDiv.nextSibling);
    } else {
        container.insertBefore(btn, container.firstChild);
    }

    // Container for results
    const resultDiv = document.createElement('div');
    resultDiv.className = "smart-answer-result";
    resultDiv.style.display = "none";
    container.appendChild(resultDiv);

    btn.addEventListener('click', async (e) => {
        e.preventDefault(); // Prevent form submission if inside form

        // precise scraping relative to this container
        const { question, options } = scrapeQuestionData(container);

        if (!question) {
            alert("Could not detect question text.");
            return;
        }

        // Show loading
        resultDiv.style.display = "block";
        resultDiv.className = "smart-answer-result loading";
        resultDiv.innerText = "Thinking...";

        try {
            const response = await fetch(BACKEND_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ question, options })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            displayResult(data, resultDiv, container);

        } catch (err) {
            resultDiv.className = "smart-answer-result smart-answer-error";
            resultDiv.innerText = `Error: ${err.message}. Is backend running?`;
        }
    });
}

/**
 * Scrapes question text and options from the container.
 * @param {HTMLElement} container 
 * @returns {Object} { question: string, options: string[] }
 */
function scrapeQuestionData(container) {
    // 1. Get Question Text
    // Usually in .vtbegenerated or .legend-visible for fieldsets
    let questionText = "";

    // Try common selectors
    const qTextEl = container.querySelector('.vtbegenerated, .legend-visible, .questionText');
    if (qTextEl) {
        questionText = qTextEl.innerText;
    } else {
        // Fallback: try to get text distinct from options
        // This is tricky without specific DOM, but let's try getting direct text nodes
        // plus labels that aren't inputs.
        // For MVP, if specific class is missing, we might fail or grab all text.
        // Let's grab the whole container text but try to exclude the answers part if possible? No, safer to rely on structure.
        // let's assume .vtbegenerated is standard for now as per prompt request.
        questionText = container.innerText.split('\n')[0]; // Naive fallback
    }

    // 2. Get Options
    // Usually inputs like radio buttons or checkboxes have labels next to them.
    const options = [];

    // Look for label elements corresponding to inputs
    const labels = container.querySelectorAll('label');
    if (labels.length > 0) {
        labels.forEach(label => {
            options.push(label.innerText.trim());
        });
    } else {
        // Sometimes text is just in a table cell next to the input
        // Look for input elements, and grab parent text?
        // Blackboard usually uses tables for layout (old school)
        const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        inputs.forEach(input => {
            // Text is often in the parent TD or the next sibling
            // Try parent
            const parent = input.parentElement;
            if (parent) {
                const text = parent.innerText.trim();
                if (text) options.push(text);
            }
        });
    }

    return {
        question: questionText.trim(),
        options: options.filter(o => o.length > 0) // Filter empty
    };
}

/**
 * Displays the result in the resultDiv and optionally highlights the match in DOM.
 */
function displayResult(data, resultDiv, container) {
    resultDiv.className = "smart-answer-result";
    resultDiv.innerHTML = `
        <strong>Answer:</strong> ${data.answer} <br/>
        <small>Confidence: ${Math.round(data.confidence * 100)}%</small>
    `;

    // Highlight matching option in DOM if possible
    if (data.matched_option) {
        const labels = container.querySelectorAll('label, input'); // Basic search
        // We need to find the DOM element containing this text
        // This is loose matching for the visual highlight

        let found = false;
        // Try labels first
        const allLabels = container.querySelectorAll('label');
        for (let label of allLabels) {
            if (label.innerText.includes(data.matched_option) || data.matched_option.includes(label.innerText)) {
                label.classList.add('smart-answer-highlight');
                found = true;
            }
        }

        // Try table rows or cells if labels didn't work (common on old Blackboard)
        if (!found) {
            const allTextNodes = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
            let currentNode;
            while (currentNode = allTextNodes.nextNode()) {
                if (currentNode.nodeValue.includes(data.matched_option) && currentNode.parentElement.tagName !== "STRONG" && currentNode.parentElement.tagName !== "SCRIPT") {
                    // Ensure we are highlighting a block or nearby element
                    const wrapper = currentNode.parentElement;
                    wrapper.classList.add('smart-answer-highlight');
                    break;
                }
            }
        }
    }
}

// Start
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
