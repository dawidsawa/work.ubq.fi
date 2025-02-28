import { displayGitHubIssues } from "../fetch-github/fetch-and-display-previews";
import { taskManager } from "../home";
import { renderErrorInModal } from "../rendering/display-popup-modal";
import { Sorting } from "./generate-sorting-buttons";

export class SortingManager {
  private _lastChecked: HTMLInputElement | null = null;
  private _toolBarFilters: HTMLElement;
  private _filterTextBox: HTMLInputElement;
  private _sortingButtons: HTMLElement;
  private _instanceId: string;
  private _sortingState: { [key: string]: "unsorted" | "ascending" | "descending" } = {}; // Track state for each sorting option

  constructor(filtersId: string, sortingOptions: readonly string[], instanceId: string) {
    const filters = document.getElementById(filtersId);
    if (!filters) throw new Error(`${filtersId} not found`);
    this._toolBarFilters = filters;
    this._instanceId = instanceId;
    this._filterTextBox = this._generateFilterTextBox();
    this._sortingButtons = this._generateSortingButtons(sortingOptions);

    // Initialize sorting states to 'unsorted' for all options
    sortingOptions.forEach((option) => {
      this._sortingState[option] = "unsorted";
    });
  }

  public render() {
    this._toolBarFilters.appendChild(this._filterTextBox);
    this._toolBarFilters.appendChild(this._sortingButtons);
  }

  private _generateFilterTextBox() {
    const textBox = document.createElement("input");
    textBox.type = "text";
    textBox.id = `filter-${this._instanceId}`;
    textBox.placeholder = "Search";

    // Handle CTRL+F
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        textBox.focus();
      }
    });

    // Get the search query from the URL (if it exists) and pre-fill the input
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get("search") || "";
    textBox.value = searchQuery;

    const issuesContainer = document.getElementById("issues-container") as HTMLDivElement;

    function filterIssues() {
      try {
        const filterText = textBox.value.toLowerCase();
        const issues = Array.from(issuesContainer.children) as HTMLDivElement[];
        issues.forEach((issue) => {
          const issueId = issue.children[0].getAttribute("data-issue-id");
          issue.classList.add("active");
          if (!issueId) return;
          const gitHubIssue = taskManager.getGitHubIssueById(parseInt(issueId));
          if (!gitHubIssue) return;
          const searchableProperties = ["title", "body", "number", "html_url"] as const;
          const searchableStrings = searchableProperties.map((prop) => gitHubIssue[prop]?.toString().toLowerCase());
          const isVisible = searchableStrings.some((str) => str?.includes(filterText));
          issue.style.display = isVisible ? "block" : "none";
        });
      } catch (error) {
        return renderErrorInModal(error as Error);
      }
    }

    // Observer to detect when children are added to the issues container (only once)
    const observer = new MutationObserver(() => {
      if (issuesContainer.children.length > 0) {
        observer.disconnect(); // Stop observing once children are present
        if (searchQuery) filterIssues(); // Filter on load if search query exists
      }
    });
    observer.observe(issuesContainer, { childList: true });

    textBox.addEventListener("input", () => {
      const filterText = textBox.value;
      // Update the URL with the search parameter
      const newURL = new URL(window.location.href);
      newURL.searchParams.set("search", filterText);
      window.history.replaceState({}, "", newURL.toString());
      filterIssues(); // Run the filter function immediately on input
    });

    return textBox;
  }

  private _generateSortingButtons(sortingOptions: readonly string[]) {
    const buttons = document.createElement("div");
    buttons.className = "labels";

    sortingOptions.forEach((option) => {
      const input = this._createRadioButton(option);
      const label = this._createLabel(option);

      buttons.appendChild(input);
      buttons.appendChild(label);

      input.addEventListener("click", () => {
        try {
          void this._handleSortingClick(input, option);
        } catch (error) {
          renderErrorCatch(error as ErrorEvent);
        }
      });
    });

    return buttons;
  }

  private _createRadioButton(option: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "radio";
    input.value = option;
    input.id = `${option}-${this._instanceId}`;
    input.name = `sort-${this._instanceId}`;
    return input;
  }

  private _createLabel(option: string): HTMLLabelElement {
    const label = document.createElement("label");
    label.htmlFor = `${option}-${this._instanceId}`;
    label.textContent = option.charAt(0).toUpperCase() + option.slice(1);
    return label;
  }

  private _handleSortingClick(input: HTMLInputElement, option: string) {
    const currentOrdering = input.getAttribute("data-ordering");
    let newOrdering: string;

    // Determine the new ordering based on the current state
    if (currentOrdering === "normal") {
      newOrdering = "reverse";
    } else if (currentOrdering === "reverse") {
      newOrdering = "disabled";
    } else {
      newOrdering = "normal";
    }

    // Apply the new ordering state
    input.setAttribute("data-ordering", newOrdering);
    input.parentElement?.childNodes.forEach((node) => {
      if (node instanceof HTMLInputElement) {
        node.setAttribute("data-ordering", "");
      }
    });

    if (newOrdering === "disabled") {
      this._lastChecked = null;
      input.checked = false;
      this._clearSorting();
    } else {
      input.checked = input !== this._lastChecked;
      this._lastChecked = input.checked ? input : null;
      input.setAttribute("data-ordering", newOrdering);

      // Apply the sorting based on the new state (normal or reverse)
      try {
        void displayGitHubIssues({ sorting: option as Sorting, options: { ordering: newOrdering } });
      } catch (error) {
        renderErrorCatch(error as ErrorEvent);
      }
    }
  }

  private _clearSorting() {
    try {
      void displayGitHubIssues();
    } catch (error) {
      renderErrorInModal(error as Error);
    }
  }
}

function renderErrorCatch(event: ErrorEvent) {
  return renderErrorInModal(event.error);
}
