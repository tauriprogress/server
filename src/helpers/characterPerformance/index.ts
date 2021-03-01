import { LooseObject } from "../../types";

import { getNestedObjectValue, addNestedObjectValue } from "../../helpers";

export function addToCharTotalPerformance(
    total: LooseObject,
    categorization: Array<number | string>,
    combatMetricValue: number
) {
    let prevTotalValue = getNestedObjectValue(total, categorization);
    if (!combatMetricValue) {
        return addNestedObjectValue(
            total,
            categorization,
            prevTotalValue || false
        );
    }
    if (!prevTotalValue) {
        return addNestedObjectValue(total, categorization, combatMetricValue);
    }
    return addNestedObjectValue(
        total,
        categorization,
        prevTotalValue + combatMetricValue
    );
}
