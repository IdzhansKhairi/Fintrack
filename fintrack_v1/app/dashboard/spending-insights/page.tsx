"use client";

import React from 'react';
import { Tag, Table, Tooltip } from 'antd';
import { useState, useEffect } from 'react';
import { Bar } from '@ant-design/plots';
import { getExpenseUsageLabel, getSpendingBeneficiaryLabel, spendingBeneficiaryColors, spendingBeneficiaryLabels } from '@/lib/displayMappings';
import Link from 'next/link';
import './spendingInsights.css';

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
    transaction_spending_beneficiary: string | null;
}

// Beneficiary summary data
interface BeneficiarySummary {
    key: string;
    label: string;
    amount: number;
    percentage: number;
    color: string;
    count: number;
}

export default function SpendingInsightsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isMobile, setIsMobile] = useState(false);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

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

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Get available years from transactions
    const getAvailableYears = (): number[] => {
        const years = new Set<number>();
        transactions.forEach(t => {
            const year = parseInt(t.transaction_date.split('-')[0]);
            if (!isNaN(year)) years.add(year);
        });
        const yearsArray = Array.from(years).sort((a, b) => b - a);
        if (yearsArray.length === 0) yearsArray.push(new Date().getFullYear());
        return yearsArray;
    };

    // Filter expenses for selected month/year
    const getFilteredExpenses = (): Transaction[] => {
        return transactions.filter(t => {
            if (!t.transaction_expense_usage) return false; // Only expenses
            const [year, month] = t.transaction_date.split('-').map(Number);
            return year === selectedYear && (month - 1) === selectedMonth;
        });
    };

    // Calculate beneficiary summaries
    const getBeneficiarySummaries = (): BeneficiarySummary[] => {
        const expenses = getFilteredExpenses();
        const totalExpenses = expenses.reduce((sum, t) => sum + t.transaction_amount, 0);

        // Group by beneficiary
        const groups: Record<string, { amount: number; count: number }> = {};
        
        expenses.forEach(t => {
            const key = t.transaction_spending_beneficiary || 'uncategorized';
            if (!groups[key]) {
                groups[key] = { amount: 0, count: 0 };
            }
            groups[key].amount += t.transaction_amount;
            groups[key].count += 1;
        });

        // Convert to summary array
        const summaries: BeneficiarySummary[] = Object.entries(groups).map(([key, data]) => ({
            key,
            label: key === 'uncategorized' ? 'Uncategorized' : getSpendingBeneficiaryLabel(key),
            amount: parseFloat(data.amount.toFixed(2)),
            percentage: totalExpenses > 0 ? parseFloat(((data.amount / totalExpenses) * 100).toFixed(1)) : 0,
            color: spendingBeneficiaryColors[key] || '#d9d9d9',
            count: data.count,
        }));

        // Sort by amount descending
        return summaries.sort((a, b) => b.amount - a.amount);
    };

    // Get monthly comparison data (last 6 months from selected month)
    const getMonthlyComparisonData = (): any[] => {
        const data: any[] = [];
        
        for (let i = 5; i >= 0; i--) {
            let month = selectedMonth - i;
            let year = selectedYear;
            if (month < 0) {
                month += 12;
                year -= 1;
            }

            const monthExpenses = transactions.filter(t => {
                if (!t.transaction_expense_usage) return false;
                const [tYear, tMonth] = t.transaction_date.split('-').map(Number);
                return tYear === year && (tMonth - 1) === month;
            });

            // Group by beneficiary for this month
            const beneficiaryKeys = Object.keys(spendingBeneficiaryLabels);
            beneficiaryKeys.forEach(key => {
                const amount = monthExpenses
                    .filter(t => t.transaction_spending_beneficiary === key)
                    .reduce((sum, t) => sum + t.transaction_amount, 0);
                
                if (amount > 0) {
                    data.push({
                        month: `${months[month].substring(0, 3)} ${year}`,
                        beneficiary: getSpendingBeneficiaryLabel(key),
                        amount: parseFloat(amount.toFixed(2)),
                    });
                }
            });

            // Uncategorized
            const uncategorizedAmount = monthExpenses
                .filter(t => !t.transaction_spending_beneficiary)
                .reduce((sum, t) => sum + t.transaction_amount, 0);
            if (uncategorizedAmount > 0) {
                data.push({
                    month: `${months[month].substring(0, 3)} ${year}`,
                    beneficiary: 'Uncategorized',
                    amount: parseFloat(uncategorizedAmount.toFixed(2)),
                });
            }
        }

        return data;
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${day} ${monthNames[parseInt(month) - 1]} ${year}`;
    };

    // Format time
    const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    const summaries = getBeneficiarySummaries();
    const totalExpenses = summaries.reduce((sum, s) => sum + s.amount, 0);

    // Beneficiary icon mapping
    const beneficiaryIcons: Record<string, string> = {
        'personal': 'bi-person',
        'family': 'bi-house-heart',
        'dating': 'bi-heart',
        'friends': 'bi-people',
        'work': 'bi-briefcase',
        'charity': 'bi-gift',
        'na': 'bi-dash-circle',
        'uncategorized': 'bi-question-circle',
    };

    // Monthly comparison bar chart config
    const monthlyBarConfig = {
        data: getMonthlyComparisonData(),
        xField: 'month',
        yField: 'amount',
        colorField: 'beneficiary',
        group: true,
        style: {
            radiusEndTopLeft: 4,
            radiusEndTopRight: 4,
        },
        tooltip: (d: any) => ({
            name: d.beneficiary,
            value: `MYR ${d.amount.toFixed(2)}`,
        }),
    };

    // Table columns for expense transactions
    const columns = [
        {
            title: 'Date',
            dataIndex: 'transaction_date',
            key: 'transaction_date',
            width: isMobile ? 100 : undefined,
            render: (value: string) => formatDate(value),
            sorter: (a: Transaction, b: Transaction) => a.transaction_date.localeCompare(b.transaction_date),
        },
        {
            title: 'Time',
            dataIndex: 'transaction_time',
            key: 'transaction_time',
            width: isMobile ? 80 : undefined,
            render: (value: string) => formatTime(value),
        },
        {
            title: 'Description',
            dataIndex: 'transaction_description',
            key: 'transaction_description',
            width: isMobile ? 180 : undefined,
        },
        {
            title: 'Amount',
            key: 'transaction_amount',
            render: (record: Transaction) => (
                <span className='text-danger fw-bold'>
                    - MYR {record.transaction_amount.toFixed(2)}
                </span>
            ),
            sorter: (a: Transaction, b: Transaction) => a.transaction_amount - b.transaction_amount,
        },
        {
            title: 'Usage',
            key: 'expense_usage',
            render: (record: Transaction) => (
                <Tag color="red">{getExpenseUsageLabel(record.transaction_expense_usage)}</Tag>
            ),
        },
        {
            title: 'Spent For',
            key: 'spending_beneficiary',
            render: (record: Transaction) => {
                const label = getSpendingBeneficiaryLabel(record.transaction_spending_beneficiary);
                const color = record.transaction_spending_beneficiary
                    ? spendingBeneficiaryColors[record.transaction_spending_beneficiary] || '#d9d9d9'
                    : '#d9d9d9';
                return <Tag color={color}>{label}</Tag>;
            },
            filters: [
                { text: 'Personal', value: 'personal' },
                { text: 'Family', value: 'family' },
                { text: 'Dating', value: 'dating' },
                { text: 'Friends', value: 'friends' },
                { text: 'Work', value: 'work' },
                { text: 'Charity', value: 'charity' },
                { text: 'Not Applicable', value: 'na' },
                { text: 'Uncategorized', value: 'null' },
            ],
            onFilter: (value: any, record: Transaction) => {
                if (value === 'null') return !record.transaction_spending_beneficiary;
                return record.transaction_spending_beneficiary === value;
            },
        },
    ];

    const tableDataSource = getFilteredExpenses().map(t => ({
        ...t,
        key: t.transaction_id,
    }));

    return (
        <div>
            <div className='d-flex align-items-center title-pages'>
                <i className='bi bi-bar-chart-line fs-3 text-secondary me-2 bi-title'></i>
                <h3 className='text-secondary m-0 p-0'>Spending Insights</h3>
            </div>

            <div className='border-bottom my-3'></div>

            {/* Filters */}
            <div className='row mb-3'>
                <div className='col-12'>
                    <div className='card insights-filter-card'>
                        <div className='card-body p-3'>
                            <div className='row g-3 align-items-end'>
                                <div className='col-md-3 col-6'>
                                    <label className='form-label fw-bold small mb-1'>Month</label>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    >
                                        {months.map((month, index) => (
                                            <option key={index} value={index}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className='col-md-3 col-6'>
                                    <label className='form-label fw-bold small mb-1'>Year</label>
                                    <select
                                        className='form-select form-select-sm'
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    >
                                        {getAvailableYears().map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className='col-md-6 d-flex align-items-center justify-content-end'>
                                    <div className='d-flex align-items-center'>
                                        <h5 className='mb-0 fw-bold text-danger me-2'>Total Expenses:</h5>
                                        <h5 className='mb-0 text-danger'>MYR {totalExpenses.toFixed(2)}</h5>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Percentage Bar */}
            {summaries.length > 0 ? (
                <div className='row mb-4'>
                    <div className='col-12'>
                        <div className='card'>
                            <div className='card-header'>
                                <h6 className='fw-bold m-0 p-0 py-1'>
                                    <i className='bi bi-bar-chart me-2'></i>
                                    Spending Distribution — {months[selectedMonth]} {selectedYear}
                                </h6>
                            </div>
                            <div className='card-body'>
                                {/* Custom Percentage Bar */}
                                <div className='insights-percentage-bar mb-3'>
                                    {summaries.map((s) => (
                                        <Tooltip
                                            key={s.key}
                                            title={`${s.label}: MYR ${s.amount.toFixed(2)} (${s.percentage}%)`}
                                        >
                                            <div
                                                className='bar-segment'
                                                style={{
                                                    width: `${Math.max(s.percentage, 3)}%`,
                                                    backgroundColor: s.color,
                                                }}
                                            >
                                                {s.percentage >= 8 ? `${s.percentage}%` : ''}
                                            </div>
                                        </Tooltip>
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className='d-flex flex-wrap gap-3'>
                                    {summaries.map((s) => (
                                        <div key={s.key} className='d-flex align-items-center gap-1'>
                                            <span className='legend-dot' style={{ backgroundColor: s.color }}></span>
                                            <small className='text-muted'>{s.label} ({s.percentage}%)</small>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className='row mb-4'>
                    <div className='col-12'>
                        <div className='card'>
                            <div className='card-body text-center py-5'>
                                <i className='bi bi-inbox fs-1 text-muted'></i>
                                <p className='text-muted mt-2 mb-0'>No expense data for {months[selectedMonth]} {selectedYear}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {summaries.length > 0 && (
                <div className='row mb-4'>
                    {summaries.map((s) => (
                        <div key={s.key} className='col-lg-3 col-md-4 col-6 mb-3'>
                            <div className='card insights-summary-card h-100' style={{ borderLeft: `4px solid ${s.color}` }}>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center mb-2'>
                                        <div
                                            className='beneficiary-icon me-2'
                                            style={{ backgroundColor: `${s.color}20`, color: s.color }}
                                        >
                                            <i className={`bi ${beneficiaryIcons[s.key] || 'bi-circle'}`}></i>
                                        </div>
                                        <div>
                                            <small className='text-muted fw-bold'>{s.label}</small>
                                        </div>
                                    </div>
                                    <h5 className='fw-bold mb-1'>MYR {s.amount.toFixed(2)}</h5>
                                    <div className='d-flex justify-content-between'>
                                        <small className='text-muted'>{s.percentage}% of total</small>
                                        <small className='text-muted'>{s.count} txn{s.count !== 1 ? 's' : ''}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Monthly Comparison Chart */}
            {getMonthlyComparisonData().length > 0 && (
                <div className='row mb-4'>
                    <div className='col-12'>
                        <div className='card monthly-chart-card'>
                            <div className='card-header'>
                                <h6 className='fw-bold m-0 p-0 py-1'>
                                    <i className='bi bi-graph-up me-2'></i>
                                    Monthly Comparison (Last 6 Months)
                                </h6>
                            </div>
                            <div className='card-body'>
                                <div className='insights-chart-container'>
                                    <Bar {...monthlyBarConfig} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Expense Transactions Table */}
            <div className='row mb-4'>
                <div className='col-12'>
                    <div className='card'>
                        <div className='card-header d-flex align-items-center justify-content-between p-3'>
                            <div className='d-flex align-items-center'>
                                <i className='bi bi-list-ul me-2 text-secondary'></i>
                                <h6 className='fw-bold text-secondary p-0 m-0'>
                                    Expense Transactions — {months[selectedMonth]} {selectedYear}
                                </h6>
                            </div>
                            <Link href="/dashboard/transaction-record" className='btn btn-sm btn-outline-secondary'>
                                <i className='bi bi-table me-1'></i>
                                All Records
                            </Link>
                        </div>
                        <div className='card-body p-2'>
                            <Table
                                dataSource={tableDataSource}
                                columns={columns}
                                loading={isLoading}
                                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} expenses` }}
                                scroll={{ x: isMobile ? 'max-content' : undefined }}
                                size="small"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
