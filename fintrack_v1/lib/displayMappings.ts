// lib/displayMappings.ts
// Shared display mappings for income sources and expense usages

export const incomeSourceLabels: Record<string, string> = {
    'salary': 'Salary',
    'allowance_gift': 'Allowance / Gift',
    'paybank_reimbursement': 'Payback / Reimbursement',
    'kwsp': 'KWSP',
    'transfer': 'Transfer',
    'bank_profit': 'Bank Profit',
    'borrow': 'Borrow',
    'refund': 'Refund',
    'tally': 'Tally',
    'update': 'Update',
    'move_money': 'Move Money',
    'others': 'Others',
};

export const expenseUsageLabels: Record<string, string> = {
    // Living
    'food': 'Food & Drinks',
    'groceries': 'Groceries',
    'health': 'Health',
    'household': 'Household',
    'personalcare': 'Personal Care',
    'stationaries': 'Stationaries',

    // Commitments
    'car': 'Car',
    'house': 'House',
    'utilities': 'Utilities',
    'installment': 'Installment',
    'transport': 'Transportation',
    'subscription': 'Subscription',

    // Personal
    'entertainment': 'Entertainment',
    'shopping': 'Shopping',
    'travel': 'Travel',
    'ride': 'Ride Transportation',
    'gifts': 'Gifts',
    'hobby': 'Hobby',

    // Financial
    'investment': 'Investment',
    'charity': 'Charity',
    'payback': 'Payback',
    'lend': 'Lend Money',
    'movement': 'Move Money',
    'update': 'Update Money',

    // Others
    'others': 'Others',
};

export const hobbyLabels: Record<string, string> = {
    'gunpla': 'Gunpla',
    'music': 'Music',
    'climbing': 'Climbing',
    'decoration': 'Decoration',
    'technology': 'Technology',
};

export const spendingBeneficiaryLabels: Record<string, string> = {
    'personal': 'Personal',
    'family': 'Family',
    'dating': 'Dating',
    'friends': 'Friends',
    'work': 'Work',
    'charity': 'Charity',
    'na': 'Not Applicable',
};

// Color mapping for spending beneficiary tags/charts
export const spendingBeneficiaryColors: Record<string, string> = {
    'personal': '#1890ff',   // Blue
    'family': '#52c41a',     // Green
    'dating': '#722ed1',     // Purple
    'friends': '#fa8c16',    // Orange
    'work': '#13c2c2',       // Teal
    'charity': '#2f54eb',    // Indigo
    'na': '#8c8c8c',         // Gray
    'uncategorized': '#d9d9d9', // Light gray
};

// Expense usage to category mapping (based on optgroups in add-transaction)
export const expenseUsageCategoryMapping: Record<string, string> = {
    // Living
    'food': 'Living',
    'groceries': 'Living',
    'health': 'Living',
    'household': 'Living',
    'personalcare': 'Living',

    // Commitments
    'car': 'Commitments',
    'house': 'Commitments',
    'utilities': 'Commitments',
    'installment': 'Commitments',
    'transport': 'Commitments',
    'subscription': 'Commitments',

    // Personal
    'entertainment': 'Personal',
    'shopping': 'Personal',
    'travel': 'Personal',
    'ride': 'Personal',
    'gifts': 'Personal',
    'hobby': 'Personal',

    // Financial
    'investment': 'Financial',
    'charity': 'Financial',
    'payback': 'Financial',
    'lend': 'Financial',
    'movement': 'Financial',
    'update': 'Financial',

    // Others
    'others': 'Others',
};

// Helper function to get expense usage category
export const getExpenseUsageCategory = (expenseUsage: string | null): string | null => {
    if (!expenseUsage) return null;
    return expenseUsageCategoryMapping[expenseUsage] || 'Others';
};

// Helper functions to get display labels
export const getIncomeSourceLabel = (value: string | null): string => {
    if (!value) return '-';
    return incomeSourceLabels[value] || value;
};

export const getExpenseUsageLabel = (value: string | null): string => {
    if (!value) return '-';
    return expenseUsageLabels[value] || value;
};

export const getHobbyLabel = (value: string | null): string => {
    if (!value) return '-';
    return hobbyLabels[value] || value;
};

// Combined function to get source or usage label
export const getSourceOrUsageLabel = (
    incomeSource: string | null,
    expenseUsage: string | null
): string => {
    if (incomeSource) {
        return getIncomeSourceLabel(incomeSource);
    }
    if (expenseUsage) {
        return getExpenseUsageLabel(expenseUsage);
    }
    return '-';
};

export const getSpendingBeneficiaryLabel = (value: string | null): string => {
    if (!value) return 'Uncategorized';
    return spendingBeneficiaryLabels[value] || value;
};
