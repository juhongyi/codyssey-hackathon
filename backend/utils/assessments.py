from copy import deepcopy


def without_generated_scores(board):
    """Remove only plan-level AI assessments, preserving other provider data."""
    result = deepcopy(board)
    if isinstance(result, dict) and isinstance(result.get("plans"), list):
        for plan in result["plans"]:
            if isinstance(plan, dict):
                plan.pop("scores", None)
    return result
