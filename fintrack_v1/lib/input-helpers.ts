/**
 * Shared input helpers for SweetAlert2 dialogs.
 * These attach event listeners to raw HTML inputs to enforce formatting.
 */

/**
 * Money input helper — typing digits auto-formats as currency (e.g. 99900 → 999.00).
 * Returns a getter function for the parsed numeric value.
 */
export function setupMoneyInput(input: HTMLInputElement) {
    let rawValue = '';
    // If there's an initial value, convert it to raw digits
    if (input.value && input.value !== '0.00') {
        rawValue = Math.round(parseFloat(input.value) * 100).toString();
    }

    input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        rawValue = target.value.replace(/\D/g, ''); // remove non-digits
        target.value = rawValue ? (parseInt(rawValue) / 100).toFixed(2) : '';
    });

    // Return getter for the actual numeric value
    return () => rawValue ? parseFloat((parseInt(rawValue) / 100).toFixed(2)) : 0;
}

/**
 * Whole number input helper — prevents decimals.
 */
export function setupWholeNumberInput(input: HTMLInputElement) {
    input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        target.value = target.value.replace(/\D/g, '');
    });
}
