"use client"

import React from 'react';

import { useState, useEffect } from 'react';

import { LineChartOutlined, BarChartOutlined, AreaChartOutlined, PieChartOutlined, DashboardOutlined } from '@ant-design/icons';

import { Line } from '@ant-design/charts';
import { Pie } from '@ant-design/plots';
import { Column } from '@ant-design/plots';

// Type for transaction from database
interface Transaction {
    transaction_id: number;
    transaction_date: string;
    transaction_time: string;
    transaction_description: string;
    transaction_amount: number;
    transaction_category: string;
    transaction_sub_category: string;
    transaction_card_choice: string | null;
    transaction_income_source: string | null;
    transaction_expense_usage: string | null;
    transaction_expense_usage_category: string | null;
    transaction_hobby_category: string | null;
}

export default function DashboardPage() {

    const [transactionTypeView, setTypeView] = useState('overall_overview');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // State for year and month selection (defaults to current)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed (0 = January)

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    // Detect if device is mobile for responsive chart labels
    const [isMobile, setIsMobile] = useState(false);

    // Month names for display and selection
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    // Generate year options (e.g., 5 years back to current year)
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

    // Fetch transactions from database
    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/transactions');
                const data = await response.json();
                setTransactions(data);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, []);

    // Detect mobile for responsive label positioning
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Helper function: Get Yearly Income Trend data (for Line Chart)
    // Groups income transactions by month for the current year
    const getYearlyIncomeData = () => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize all months with 0
        const monthlyTotals: { [key: string]: number } = {};
        monthNames.forEach(m => monthlyTotals[m] = 0);

        // Filter income transactions for current year and sum by month
        transactions
            .filter(t => t.transaction_income_source !== null) // Only income
            .filter(t => {
                const transYear = new Date(t.transaction_date).getFullYear();
                return transYear === selectedYear; // Only selected year
            })
            .forEach(t => {
                const transMonth = new Date(t.transaction_date).getMonth(); // 0-indexed
                const monthKey = monthNames[transMonth];
                monthlyTotals[monthKey] += t.transaction_amount;
            });

        // Convert to chart format
        return monthNames.map(m => ({
            month: m,
            value: monthlyTotals[m]
        }));
    };

    // Helper function: Get Monthly Income by Category data (for Pie Chart)
    // Groups income transactions by category (E-Wallet, Cash, Card) for current month
    const getMonthlyIncomeByCategoryData = () => {
        const categories = ['E-Wallet', 'Cash', 'Card'];

        // Initialize all categories with 0
        const categoryTotals: { [key: string]: number } = {};
        categories.forEach(c => categoryTotals[c] = 0);

        // Filter income transactions for current month/year and sum by category
        transactions
            .filter(t => t.transaction_income_source !== null) // Only income
            .filter(t => {
                const transDate = new Date(t.transaction_date);
                const transYear = transDate.getFullYear();
                const transMonth = transDate.getMonth();
                return transYear === selectedYear && transMonth === selectedMonth; // Selected month and year
            })
            .forEach(t => {
                const category = t.transaction_category; // E-Wallet, Cash, or Card
                if (categoryTotals[category] !== undefined) {
                    categoryTotals[category] += t.transaction_amount;
                }
            });

        // Convert to chart format, filter out zero values for better pie display
        const data = categories
            .map(c => ({ type: c, value: categoryTotals[c] }))
            .filter(d => d.value > 0);

        // Return at least one item to prevent empty chart
        return data.length > 0 ? data : [{ type: 'No Data', value: 0 }];
    };

    // Helper function: Get Yearly Expense Trend data (for Line Chart)
    // Groups expense transactions by month for the selected year
    const getYearlyExpenseData = () => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize all months with 0
        const monthlyTotals: { [key: string]: number } = {};
        monthNames.forEach(m => monthlyTotals[m] = 0);

        // Filter expense transactions for selected year and sum by month
        transactions
            .filter(t => t.transaction_expense_usage !== null) // Only expenses
            .filter(t => {
                const transYear = new Date(t.transaction_date).getFullYear();
                return transYear === selectedYear; // Only selected year
            })
            .forEach(t => {
                const transMonth = new Date(t.transaction_date).getMonth(); // 0-indexed
                const monthKey = monthNames[transMonth];
                monthlyTotals[monthKey] += t.transaction_amount;
            });

        // Convert to chart format
        return monthNames.map(m => ({
            month: m,
            value: monthlyTotals[m]
        }));
    };

    // Helper function: Get Monthly Expense by Category data (for Pie Chart)
    // Groups expense transactions by category (E-Wallet, Cash, Card) for selected month
    const getMonthlyExpenseByCategoryData = () => {
        const categories = ['E-Wallet', 'Cash', 'Card'];

        // Initialize all categories with 0
        const categoryTotals: { [key: string]: number } = {};
        categories.forEach(c => categoryTotals[c] = 0);

        // Filter expense transactions for selected month/year and sum by category
        transactions
            .filter(t => t.transaction_expense_usage !== null) // Only expenses
            .filter(t => {
                const transDate = new Date(t.transaction_date);
                const transYear = transDate.getFullYear();
                const transMonth = transDate.getMonth();
                return transYear === selectedYear && transMonth === selectedMonth; // Selected month and year
            })
            .forEach(t => {
                const category = t.transaction_category; // E-Wallet, Cash, or Card
                if (categoryTotals[category] !== undefined) {
                    categoryTotals[category] += t.transaction_amount;
                }
            });

        // Convert to chart format, filter out zero values for better pie display
        const data = categories
            .map(c => ({ type: c, value: categoryTotals[c] }))
            .filter(d => d.value > 0);

        // Return at least one item to prevent empty chart
        return data.length > 0 ? data : [{ type: 'No Data', value: 0 }];
    };

    // ============ OVERALL OVERVIEW HELPER FUNCTIONS ============

    // Helper function: Get Yearly Income VS Expense data (for Double Line Chart)
    // Combines income and expense data by month for the selected year
    const getYearlyIncomeVSExpenseData = () => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize monthly totals for both income and expense
        const monthlyIncome: { [key: string]: number } = {};
        const monthlyExpense: { [key: string]: number } = {};
        monthNames.forEach(m => {
            monthlyIncome[m] = 0;
            monthlyExpense[m] = 0;
        });

        // Calculate income by month
        transactions
            .filter(t => t.transaction_income_source !== null)
            .filter(t => new Date(t.transaction_date).getFullYear() === selectedYear)
            .forEach(t => {
                const monthKey = monthNames[new Date(t.transaction_date).getMonth()];
                monthlyIncome[monthKey] += t.transaction_amount;
            });

        // Calculate expense by month
        transactions
            .filter(t => t.transaction_expense_usage !== null)
            .filter(t => new Date(t.transaction_date).getFullYear() === selectedYear)
            .forEach(t => {
                const monthKey = monthNames[new Date(t.transaction_date).getMonth()];
                monthlyExpense[monthKey] += t.transaction_amount;
            });

        // Combine into chart format (each month has 2 entries: Income and Expenses)
        const data: { month: string; type: string; value: number }[] = [];
        monthNames.forEach(m => {
            data.push({ month: m, type: 'Income', value: monthlyIncome[m] });
            data.push({ month: m, type: 'Expenses', value: monthlyExpense[m] });
        });

        return data;
    };

    // Helper function: Get Monthly Income VS Expense data (for Pie Chart)
    // Total income vs total expense for the selected month
    const getMonthlyIncomeVSExpenseData = () => {
        let totalIncome = 0;
        let totalExpense = 0;

        // Calculate total income for selected month/year
        transactions
            .filter(t => t.transaction_income_source !== null)
            .filter(t => {
                const transDate = new Date(t.transaction_date);
                return transDate.getFullYear() === selectedYear && transDate.getMonth() === selectedMonth;
            })
            .forEach(t => {
                totalIncome += t.transaction_amount;
            });

        // Calculate total expense for selected month/year
        transactions
            .filter(t => t.transaction_expense_usage !== null)
            .filter(t => {
                const transDate = new Date(t.transaction_date);
                return transDate.getFullYear() === selectedYear && transDate.getMonth() === selectedMonth;
            })
            .forEach(t => {
                totalExpense += t.transaction_amount;
            });

        const data = [
            { type: 'income', typeValue: 'Income', value: totalIncome },
            { type: 'expense', typeValue: 'Expense', value: totalExpense }
        ].filter(d => d.value > 0);

        return data.length > 0 ? data : [{ type: 'none', typeValue: 'No Data', value: 0 }];
    };

    // Helper function: Get Yearly Savings Trend data (for Line Chart)
    // Shows the cumulative balance of the "Savings" sub-category account at the end of each month
    const getYearlySavingsTrendData = () => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Filter only transactions for the "Savings" sub-category in the selected year
        const savingsTransactions = transactions.filter(
            t => t.transaction_sub_category === 'Savings' &&
                 new Date(t.transaction_date).getFullYear() === selectedYear
        );

        // Find the latest month that has any savings transaction
        let latestMonthWithData = -1;
        savingsTransactions.forEach(t => {
            const transMonth = new Date(t.transaction_date).getMonth();
            if (transMonth > latestMonthWithData) {
                latestMonthWithData = transMonth;
            }
        });

        // Calculate cumulative savings balance at the end of each month
        const monthlyCumulativeBalance: { [key: string]: number } = {};

        // Calculate carry-over balance from ALL years before selectedYear
        let runningBalance = 0;
        transactions
            .filter(t => t.transaction_sub_category === 'Savings' &&
                         new Date(t.transaction_date).getFullYear() < selectedYear)
            .forEach(t => {
                if (t.transaction_income_source !== null) {
                    runningBalance += t.transaction_amount;
                } else if (t.transaction_expense_usage !== null) {
                    runningBalance -= t.transaction_amount;
                }
            });

        monthNames.forEach((monthName, monthIndex) => {
            // Only calculate for months up to and including the latest month with data
            if (monthIndex <= latestMonthWithData) {
                // Add transactions for this specific month to the running balance
                savingsTransactions
                    .filter(t => new Date(t.transaction_date).getMonth() === monthIndex)
                    .forEach(t => {
                        if (t.transaction_income_source !== null) {
                            // Income adds to savings
                            runningBalance += t.transaction_amount;
                        } else if (t.transaction_expense_usage !== null) {
                            // Expense deducts from savings
                            runningBalance -= t.transaction_amount;
                        }
                    });

                monthlyCumulativeBalance[monthName] = runningBalance;
            } else {
                // Future months show 0 (no data yet)
                monthlyCumulativeBalance[monthName] = 0;
            }
        });

        // Convert to chart format
        return monthNames.map(m => ({
            month: m,
            value: monthlyCumulativeBalance[m]
        }));
    };

    // Helper function: Get Category Income VS Expense data (for Stacked Bar Chart)
    // Shows income vs expense for each category (E-Wallet, Cash, Card) for selected month
    const getCategoryIncomeVSExpenseData = () => {
        const categories = ['E-Wallet', 'Cash', 'Card'];

        // Initialize category totals
        const categoryIncome: { [key: string]: number } = {};
        const categoryExpense: { [key: string]: number } = {};
        categories.forEach(c => {
            categoryIncome[c] = 0;
            categoryExpense[c] = 0;
        });

        // Filter transactions for selected month/year
        const filteredTransactions = transactions.filter(t => {
            const transDate = new Date(t.transaction_date);
            return transDate.getFullYear() === selectedYear && transDate.getMonth() === selectedMonth;
        });

        // Calculate income by category
        filteredTransactions
            .filter(t => t.transaction_income_source !== null)
            .forEach(t => {
                const category = t.transaction_category;
                if (categoryIncome[category] !== undefined) {
                    categoryIncome[category] += t.transaction_amount;
                }
            });

        // Calculate expense by category
        filteredTransactions
            .filter(t => t.transaction_expense_usage !== null)
            .forEach(t => {
                const category = t.transaction_category;
                if (categoryExpense[category] !== undefined) {
                    categoryExpense[category] += t.transaction_amount;
                }
            });

        // Combine into chart format (each category has 2 entries: Income and Expense)
        const data: { category: string; type: string; value: number }[] = [];
        categories.forEach(c => {
            data.push({ category: c, type: 'Income', value: categoryIncome[c] });
            data.push({ category: c, type: 'Expense', value: categoryExpense[c] });
        });

        return data;
    };

    // ============ EXPENSE OVERVIEW HELPER FUNCTIONS ============

    // Helper function: Get Monthly Hobby Expenses data (for Bar Chart)
    // Groups expense transactions by hobby category for selected month
    const getMonthlyHobbyExpensesData = () => {
        const hobbyCategories = ['Gunpla', 'Music', 'Climbing', 'Decoration', 'Technology'];

        // Map database values to display labels
        const hobbyMapping: { [key: string]: string } = {
            'gunpla': 'Gunpla',
            'music': 'Music',
            'climbing': 'Climbing',
            'decoration': 'Decoration',
            'technology': 'Technology',
        };

        // Initialize all hobby categories with 0
        const hobbyTotals: { [key: string]: number } = {};
        hobbyCategories.forEach(h => hobbyTotals[h] = 0);

        // Filter expense transactions with hobby category for selected month/year
        transactions
            .filter(t => t.transaction_expense_usage === 'hobby' && t.transaction_hobby_category !== null)
            .filter(t => {
                const transDate = new Date(t.transaction_date);
                return transDate.getFullYear() === selectedYear && transDate.getMonth() === selectedMonth;
            })
            .forEach(t => {
                const hobbyLabel = hobbyMapping[t.transaction_hobby_category || ''];
                if (hobbyLabel && hobbyTotals[hobbyLabel] !== undefined) {
                    hobbyTotals[hobbyLabel] += t.transaction_amount;
                }
            });

        // Convert to chart format
        return hobbyCategories.map(h => ({
            type: h,
            value: hobbyTotals[h]
        }));
    };

    // Helper function: Get Monthly Usage Category Expenses data (for Pie Chart)
    // Groups expense transactions by usage category (Living, Commitments, Personal, Financial, Others) for selected month
    const getMonthlyUsageCategoryExpensesData = () => {
        const usageCategories = ['Living', 'Commitments', 'Personal', 'Financial', 'Others'];

        // Initialize all categories with 0
        const categoryTotals: { [key: string]: number } = {};
        usageCategories.forEach(c => categoryTotals[c] = 0);

        // Filter expense transactions for selected month/year and sum by usage category
        transactions
            .filter(t => t.transaction_expense_usage !== null && t.transaction_expense_usage_category !== null)
            .filter(t => {
                const transDate = new Date(t.transaction_date);
                return transDate.getFullYear() === selectedYear && transDate.getMonth() === selectedMonth;
            })
            .forEach(t => {
                const category = t.transaction_expense_usage_category || 'Others';
                if (categoryTotals[category] !== undefined) {
                    categoryTotals[category] += t.transaction_amount;
                }
            });

        // Convert to chart format, filter out zero values for better pie display
        const data = usageCategories
            .map(c => ({ type: c, value: categoryTotals[c] }))
            .filter(d => d.value > 0);

        // Return at least one item to prevent empty chart
        return data.length > 0 ? data : [{ type: 'No Data', value: 0 }];
    };

    // The line below here is for the demo data for viewing graph
    //------------------------------------------------------------------------
    // Now using dynamic data from getYearlyIncomeVSExpenseData()
    const yearIncomeVSExpense_config = {
        data: getYearlyIncomeVSExpenseData(),
        xField: 'month',
        yField: 'value',
        seriesField: 'type',
        colorField: 'type',
        point: {
            shapeField: 'square',
            sizeField: 4,
        },
        interaction: {
            tooltip: {
                marker: false,
            },
        },
        style: {
            lineWidth: 2,
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    };

    // Now using dynamic data from getMonthlyIncomeVSExpenseData()
    const monthlyIncomeVSExpense_config = {
        data: getMonthlyIncomeVSExpenseData(),
        angleField: 'value',
        colorField: 'typeValue',
        innerRadius: 0.6,
        label: {
            text: (d: any) => `${d.typeValue}\nMYR ${d.value.toFixed(2)}`,
            style: {
                fill: 'black',
                fontWeight: 'bold',
            },
            position: isMobile ? 'inside' : 'outside'
        },
        legend: {
            color: {
                position: 'bottom',
                layout: { justifyContent: 'center' },
            },
        },
        tooltip: (d: any) => ({
            name: d.typeValue,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    }

    // Now using dynamic data from getYearlySavingsTrendData()
    const savingsTrend_config = {
        data: getYearlySavingsTrendData(),
        xField: 'month',
        yField: 'value',
        point: {
            shapeField: 'square',
            sizeField: 4,
        },
        style: {
            lineWidth: 2,
        },
        tooltip: (d: any) => ({
            name: 'Savings',
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    };

    // Now using dynamic data from getCategoryIncomeVSExpenseData()
    const categoryIncomeVSExpense_config = {
        data: getCategoryIncomeVSExpenseData(),
        xField: 'category',
        yField: 'value',
        stack: true,
        colorField: 'type',
        label: {
            text: (d: any) => d.value > 0 ? `${d.value.toFixed(2)}` : '',
            style: {
                fontWeight: 'bold',
                fill: 'white'
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    }

    // Now using dynamic data from getYearlyIncomeData()
    const yearIncome_config = {
        data: getYearlyIncomeData(),
        xField: 'month',
        yField: 'value',
        point: {
            shapeField: 'square',
            sizeField: 4,
        },
        interaction: {
            tooltip: {
                marker: false,
            },
        },
        style: {
            lineWidth: 2,
        },
        tooltip: (d: any) => ({
            name: 'Income',
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    };

    // Now using dynamic data from getMonthlyIncomeByCategoryData()
    const monthlyIncomeByCategory_config = {
        data: getMonthlyIncomeByCategoryData(),
        angleField: 'value',
        colorField: 'type',
        innerRadius: 0.6,
        label: {
            text: (d: any) => `MYR ${d.value.toFixed(2)}`,
            style: {
                fontWeight: 'bold',
                fill: 'black'
            },
            position: isMobile ? 'inside' : 'spider'
        },
        legend: {
            color: {
                position: 'bottom',
                layout: { justifyContent: 'center' },
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    }

    // Now using dynamic data from getYearlyExpenseData()
    const yearExpense_config = {
        data: getYearlyExpenseData(),
        xField: 'month',
        yField: 'value',
        point: {
            shapeField: 'square',
            sizeField: 4,
        },
        interaction: {
            tooltip: {
                marker: false,
            },
        },
        style: {
            lineWidth: 2,
        },
        tooltip: (d: any) => ({
            name: 'Expense',
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    };

    // Now using dynamic data from getMonthlyExpenseByCategoryData()
    const monthlyExpenseByCategory_config = {
        data: getMonthlyExpenseByCategoryData(),
        angleField: 'value',
        colorField: 'type',
        innerRadius: 0.6,
        label: {
            text: (d: any) => `\n\n${d.type}\nMYR ${d.value.toFixed(2)}`,
            style: {
                fontWeight: 'bold',
                fill: 'black'
            },
            position: isMobile ? 'inside' : 'spider'
        },
        legend: {
            color: {
                position: 'bottom',
                layout: { justifyContent: 'center' },
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    }

    // Now using dynamic data from getMonthlyHobbyExpensesData()
    const monthlyHobbyExpenses_config = {
        data: getMonthlyHobbyExpensesData(),
        xField: 'type',
        yField: 'value',
        colorField: 'type',
        label: {
            text: (d: any) => d.value > 0 ? `${d.value.toFixed(2)}` : '',
            style: {
                fontWeight: 'bold',
                fill: 'white'
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    }

    // Now using dynamic data from getMonthlyUsageCategoryExpensesData()
    const monthlyCategoryExpense_config = {
        data: getMonthlyUsageCategoryExpensesData(),
        angleField: 'value',
        colorField: 'type',
        innerRadius: 0.6,
        label: {
            text: (d: any) => `MYR ${d.value.toFixed(2)}`,
            style: {
                fontWeight: 'bold',
                fill: '#000000'
            },
            position: isMobile ? 'inside' : 'spider'
        },
        legend: {
            color: {
                position: 'bottom',
                layout: { justifyContent: 'center' },
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    }
    
    //------------------------------------------------------------------------

    return (
        <div>
            <div className='d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3'>
                <div className='d-flex align-items-center title-pages'>
                    <DashboardOutlined className='fs-3 text-secondary me-2 bi-title'/>
                    <h3 className='text-secondary p-0 m-0'><strong>Finance Dashboard</strong></h3>
                </div>  
                                
                <div className="btn-group view-mode-buttons dashboard-btn-responsive" role="group">
                    <button type="button" className={`btn ${transactionTypeView === 'overall_overview' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTypeView('overall_overview')}>
                        Overall Overview
                    </button>
                    <button type="button" className={`btn ${transactionTypeView === 'income_overview' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setTypeView('income_overview')}>
                        Income Overview
                    </button>
                    <button type="button" className={`btn ${transactionTypeView === 'expense_overview' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => setTypeView('expense_overview')}>
                        Expense Overview
                    </button>
                </div>
            </div>

            <div className='border-bottom my-3'></div>

            <div className='row m-1'>
                <div className='card p-3 px-4 pb-4 bg-secondary'>

                    {/*                 
                    Overall Overview consist of the following:
                        1. Yearly Income VS Expense (Double Line Chart)
                        2. Monthly Income VS Expense (Pie Chart)
                        3. Yearly Savings Trend (Line Chart)
                        4. Monthly Income VS Expense by Category (Stacked Bar Chart)
                     */}
                    {transactionTypeView === 'overall_overview' && (
                        <div>
                            <div className='d-flex cancel-dflex flex-column flex-md-row align-items-start align-items-md-center justify-content-between pb-3 gap-2'>
                                <h5 className='fw-bold h-responsive-padding text-white m-0'>Overall Expenditure</h5>

                                {/* Year and Month Selectors */}
                                <div className='d-flex flex-wrap flex-md-nowrap align-items-center date-selectors gap-2'>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        style={{ minWidth: '130px' }}
                                    >
                                        {monthNames.map((m, index) => (
                                            <option key={m} value={index}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        style={{ minWidth: '100px' }}
                                    >
                                        {yearOptions.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className='row mb-4 charts-container'>
                                <div className='col-12 col-md-6 mb-3 mb-md-0 dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <LineChartOutlined className='me-2' />
                                            <label className='fw-bold'>Year {selectedYear} Income VS Expenses</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Line className={'d-flex justify-content-center'} {...yearIncomeVSExpense_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='col-12 col-md-6 mb-3 mb-md-0 dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <PieChartOutlined  className='me-2' />
                                            <label className='fw-bold'>Income VS Expenses ({monthNames[selectedMonth]} {selectedYear})</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Pie className={'d-flex justify-content-center'} {...monthlyIncomeVSExpense_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className='row'>
                                <div className='col-12 col-md-6 mb-3 mb-md-0 dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <LineChartOutlined className='me-2' />
                                            <label className='fw-bold'>Year {selectedYear} Savings Trend</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Line className={'d-flex justify-content-center'} {...savingsTrend_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='col-12 col-md-6 mb-3 mb-md-0 dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <BarChartOutlined className='me-2' />
                                            <label className='fw-bold'>Income VS Expenses by Category ({monthNames[selectedMonth]} {selectedYear})</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Column className={'d-flex justify-content-center'} {...categoryIncomeVSExpense_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div> 
                        </div>
                    )}


                    {/*                 
                    Overall Income Overview consist of the following:
                        1. Yearly Income Trend (Line Chart)
                        2. Monthly Income by Category (Pie Chart)
                     */}
                    {transactionTypeView === 'income_overview' && (
                        <div>
                            <div className='d-flex cancel-dflex flex-column flex-md-row align-items-start align-items-md-center justify-content-between pb-3 gap-2'>
                                <h5 className='fw-bold h-responsive-padding text-white m-0'>Income Overview</h5>

                                {/* Year and Month Selectors */}
                                <div className='d-flex flex-wrap flex-md-nowrap align-items-center date-selectors gap-2'>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        style={{ minWidth: '130px' }}
                                    >
                                        {monthNames.map((m, index) => (
                                            <option key={m} value={index}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        style={{ minWidth: '100px' }}
                                    >
                                        {yearOptions.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className='row mb-4'>
                                <div className='col-12 col-md-6 mb-3 mb-md-0  dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <LineChartOutlined className='me-2' />
                                            <label className='fw-bold'>Year {selectedYear} Income Trend</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Line className={'d-flex justify-content-center'} {...yearIncome_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='col-12 col-md-6 mb-3 mb-md-0 dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <PieChartOutlined  className='me-2' />
                                            <label className='fw-bold'>Income by Category ({monthNames[selectedMonth]} {selectedYear})</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Pie className={'d-flex justify-content-center'} {...monthlyIncomeByCategory_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/*                 
                    Overall Expense Overview consist of the following:
                        1. Yearly Expense Trend (Line Chart)
                        2. Monthly Expense by Category (Pie Chart)
                        3. Monthly Expense by Usage (Pie Chart)
                        4. Monthly Hobby Expenses (Graph Chart)
                     */}
                    {transactionTypeView === 'expense_overview' && (
                        <div>
                            <div className='d-flex cancel-dflex flex-column flex-md-row align-items-start align-items-md-center justify-content-between pb-3 gap-2'>
                                <h5 className='fw-bold h-responsive-padding text-white m-0'>Expense Overview</h5>

                                {/* Year and Month Selectors */}
                                <div className='d-flex flex-wrap flex-md-nowrap align-items-center date-selectors gap-2'>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        style={{ minWidth: '130px' }}
                                    >
                                        {monthNames.map((m, index) => (
                                            <option key={m} value={index}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        style={{ minWidth: '100px' }}
                                    >
                                        {yearOptions.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className='row mb-4'>
                                <div className='col-12 col-md-6 mb-3 mb-md-0  dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <LineChartOutlined className='me-2' />
                                            <label className='fw-bold'>Year {selectedYear} Expense Trend</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Line className={'d-flex justify-content-center'} {...yearExpense_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className='col-12 col-md-6 mb-3 mb-md-0  dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <PieChartOutlined  className='me-2' />
                                            <label className='fw-bold'>Financial Category Expenses ({monthNames[selectedMonth]} {selectedYear})</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Pie className={'d-flex justify-content-center'} {...monthlyExpenseByCategory_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className='row'>
                                <div className='col-12 col-md-6 mb-3 mb-md-0  dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <BarChartOutlined className='me-2' />
                                            <label className='fw-bold'>Hobby Expenses ({monthNames[selectedMonth]} {selectedYear})</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Column className={'d-flex justify-content-center'} {...monthlyHobbyExpenses_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className='col-12 col-md-6 mb-3 mb-md-0  dashboard-cancel-col'>
                                    <div className='card'>
                                        <div className='card-header'>
                                            <PieChartOutlined  className='me-2' />
                                            <label className='fw-bold'>Usage Category Expenses ({monthNames[selectedMonth]} {selectedYear})</label>
                                        </div>
                                        <div className='card-body'>
                                            <div className='d-flex align-items-center justify-content-center' style={{height: '300px'}}>
                                                <Pie className={'d-flex justify-content-center'} {...monthlyCategoryExpense_config} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            
                            </div> 
                        </div>
                    )}

                </div>
                
            </div>

            <div className='row'>
                
            </div>
           
        
        </div>
    )
    
}