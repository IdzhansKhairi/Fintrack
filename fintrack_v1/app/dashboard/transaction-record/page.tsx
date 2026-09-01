"use client";

import React from 'react';
import { Badge, Tag, Switch, Statistic, Table, Tooltip, Carousel  } from 'antd';
import { useState, useEffect } from 'react';
import type { TableProps } from 'antd';
import { Pie } from '@ant-design/plots';

import Swal from 'sweetalert2';
import { Color } from 'antd/es/color-picker';
import { FontColorsOutlined } from '@ant-design/icons';
import { getIncomeSourceLabel, getExpenseUsageLabel } from '@/lib/displayMappings';
import Link from 'next/link';

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

interface AccountBalance {
    account_id: number;
    account_category: string;
    account_sub_category: string;
    account_card_type: string | null;
    current_balance: number;
}

export default function FinancialRecordPage() {

    const [accounts, setAccounts] = useState<AccountBalance[]>([])
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Filter states
    const [dateRange, setDateRange] = useState<string>('all'); // all, today, week, month, custom
    const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all'); // all, income, expense
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

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

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
    }, []);

    // Detect mobile for responsive column widths
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fetch accounts from database
    const fetchAccounts = async () => {
        try {
            setIsLoadingAccounts(true);
            const response = await fetch('/api/accounts');
            const data = await response.json();
            setAccounts(data);
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    // Calculate totals by category
    const getEwalletData = () => {
        return accounts
            .filter(acc => acc.account_category === 'E-Wallet')
            .map(acc => ({ type: acc.account_sub_category, value: acc.current_balance }));
    };

    const getCashData = () => {
        return accounts
            .filter(acc => acc.account_category === 'Cash')
            .map(acc => ({ type: acc.account_sub_category, value: acc.current_balance }));
    };

    const getCardData = () => {
        // sub_category is division type (Past, Present, Savings, Bliss)
        return accounts
            .filter(acc => acc.account_category === 'Card')
            .map(acc => ({ type: acc.account_sub_category, value: acc.current_balance }));
    };

    const getGrandTotal = () => {
        return accounts.reduce((sum, acc) => sum + acc.current_balance, 0);
    };

    const getTotalByCategory = (category: string) => {
        return accounts
            .filter(acc => acc.account_category === category)
            .reduce((sum, acc) => sum + acc.current_balance, 0);
    };

    // Get filtered transactions based on filters
    const getFilteredTransactions = () => {
        let filtered = [...transactions];

        // Apply date range filter
        const today = new Date();
        if (dateRange === 'today') {
            const todayStr = today.toISOString().split('T')[0];
            filtered = filtered.filter(t => t.transaction_date === todayStr);
        } else if (dateRange === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().split('T')[0];
            filtered = filtered.filter(t => t.transaction_date >= weekAgoStr);
        } else if (dateRange === 'month') {
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            const monthAgoStr = monthAgo.toISOString().split('T')[0];
            filtered = filtered.filter(t => t.transaction_date >= monthAgoStr);
        } else if (dateRange === 'custom' && customStartDate && customEndDate) {
            filtered = filtered.filter(t =>
                t.transaction_date >= customStartDate &&
                t.transaction_date <= customEndDate
            );
        }

        // Apply transaction type filter
        if (transactionTypeFilter === 'income') {
            filtered = filtered.filter(t => t.transaction_income_source !== null);
        } else if (transactionTypeFilter === 'expense') {
            filtered = filtered.filter(t => t.transaction_expense_usage !== null);
        }

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                t.transaction_description.toLowerCase().includes(query) ||
                t.transaction_category.toLowerCase().includes(query) ||
                t.transaction_sub_category.toLowerCase().includes(query)
            );
        }

        return filtered;
    };

    // Calculate statistics for filtered transactions
    const getFilteredStats = () => {
        const filtered = getFilteredTransactions();

        const income = filtered
            .filter(t => t.transaction_income_source !== null)
            .reduce((sum, t) => sum + t.transaction_amount, 0);

        const expenses = filtered
            .filter(t => t.transaction_expense_usage !== null)
            .reduce((sum, t) => sum + t.transaction_amount, 0);

        return {
            income,
            expenses,
            net: income - expenses,
            count: filtered.length
        };
    };

    // Clear all filters
    const clearFilters = () => {
        setDateRange('all');
        setTransactionTypeFilter('all');
        setSearchQuery('');
        setCustomStartDate('');
        setCustomEndDate('');
    };
    
    // Filter out zero values from pie data
    const getFilteredEwalletData = () => {
        const data = getEwalletData().filter(d => d.value > 0);
        return data.length > 0 ? data : [{ type: 'No Data', value: 0 }];
    };

    const getFilteredCashData = () => {
        const data = getCashData().filter(d => d.value > 0);
        return data.length > 0 ? data : [{ type: 'No Data', value: 0 }];
    };

    const getFilteredCardData = () => {
        const data = getCardData().filter(d => d.value > 0);
        return data.length > 0 ? data : [{ type: 'No Data', value: 0 }];
    };

    const ewalletPie = {
        data: getFilteredEwalletData(),
        angleField: 'value',
        colorField: 'type',
        label: {
            text: (d: any) => `${d.value.toFixed(2)}`,
            style: {
                fontWeight: 'bold',
                fill: 'white'
            },
        },
        legend: {
            color: {
                itemLabelFill: 'white',
                itemLabelFontWeight: 'bold',
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
        innerRadius: 0.6,
        annotations: [
            {
                type: 'text',
                style: {
                    text: 'E\nWallet',
                    fill: 'white',
                    x: '50%',
                    y: '50%',
                    textAlign: 'center',
                    fontSize: 30,
                    fontStyle: 'bold',
                },
            },
        ],
    }

    const cashPie = {
        data: getFilteredCashData(),
        angleField: 'value',
        colorField: 'type',
        label: {
            text: (d: any) => `${d.value.toFixed(2)}`,
            style: {
                fontWeight: 'bold',
                fill: 'white'
            },
        },
        legend: {
            color: {
                itemLabelFill: 'white',
                itemLabelFontWeight: 'bold',
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
        innerRadius: 0.6,
        annotations: [
            {
                type: 'text',
                style: {
                    text: 'Cash',
                    fill: 'white',
                    x: '50%',
                    y: '50%',
                    textAlign: 'center',
                    fontSize: 30,
                    fontStyle: 'bold',
                },
            },
        ],
    }

    const cardPie = {
        data: getFilteredCardData(),
        angleField: 'value',
        colorField: 'type',
        label: {
            text: (d: any) => `${d.value.toFixed(2)}`,
            style: {
                fontWeight: 'bold',
                fill: 'white'
            },
        },
        legend: {
            color: {
                itemLabelFill: 'white',
                itemLabelFontWeight: 'bold',
            },
        },
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
        innerRadius: 0.6,
        annotations: [
            {
                type: 'text',
                style: {
                    text: 'Cards',
                    fill: 'white',
                    x: '50%',
                    y: '50%',
                    textAlign: 'center',
                    fontSize: 30,
                    fontStyle: 'bold',
                },
            },
        ],
    }

    // Format date from YYYY-MM-DD to DD MMM YYYY
    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${day} ${monthNames[parseInt(month) - 1]} ${year}`;
    };

    // Format time from HH:MM (24-hour) to HH:MM AM/PM (12-hour)
    const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12; // Convert 0 to 12 for midnight
        return `${hour12}:${minutes} ${ampm}`;
    };

    const columns = [
        {
            title: 'Date',
            dataIndex: 'transaction_date',
            key: 'transaction_date',
            width: isMobile ? 100 : undefined,
            sorter: (a: Transaction, b: Transaction) => a.transaction_date.localeCompare(b.transaction_date),
            render: (value: string) => formatDate(value),
        },
        {
            title: 'Time',
            dataIndex: 'transaction_time',
            key: 'transaction_time',
            width: isMobile ? 100 : undefined,
            render: (value: string) => formatTime(value),
        },
        {
            title: 'Description',
            dataIndex: 'transaction_description',
            key: 'transaction_description',
            width: isMobile ? 200 : undefined,
        },
        {
            title: 'Amount',
            key: 'transaction_amount',
            render: (record: Transaction) => {
                const isIncome = record.transaction_income_source !== null;
                return (
                    <span className={isIncome ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                        {isIncome ? '+' : '-'} MYR {record.transaction_amount.toFixed(2)}
                    </span>
                );
            },
        },
        {
            title: 'Category',
            dataIndex: 'transaction_category',
            key: 'transaction_category',
            filters: [
                { text: 'E-Wallet', value: 'E-Wallet' },
                { text: 'Cash', value: 'Cash' },
                { text: 'Card', value: 'Card' },
            ],
            onFilter: (value: any, record: Transaction) => record.transaction_category === value,
        },
        {
            title: 'Sub-category',
            dataIndex: 'transaction_sub_category',
            key: 'transaction_sub_category',
        },
        // {
        //     title: 'Card Type',
        //     dataIndex: 'transaction_card_choice',
        //     key: 'transaction_card_choice',
        //     render: (value: string | null) => value || '-',
        // },
        {
            title: 'Source / Usage',
            key: 'source_usage',
            render: (record: Transaction) => {
                if (record.transaction_income_source) {
                    return <Tag color="green">{getIncomeSourceLabel(record.transaction_income_source)}</Tag>;
                }
                if (record.transaction_expense_usage) {
                    return <Tag color="red">{getExpenseUsageLabel(record.transaction_expense_usage)}</Tag>;
                }
                return '-';
            },
        },
    ];

    // Transform filtered transactions for table dataSource
    const dataSource = getFilteredTransactions().map((t) => ({
        ...t,
        key: t.transaction_id,
    }));

    const contentStyle: React.CSSProperties = {
        margin: 0,
        height: '160px',
        color: '#fff',
        lineHeight: '160px',
        textAlign: 'center',
        background: '#364d79',
    };

    const onChange = (currentSlide: number) => {
        console.log(currentSlide);
    };

    return (
        <div>
            <div className='d-flex align-items-center justify-content-between mb-3 mx-sm-0 mx-2'>
                <div className='d-flex align-items-center'>
                    <i className='bi bi-table fs-3 text-secondary me-2 bi-title'></i>
                    <h3 className='text-secondary p-0 m-0'>Transaction Records</h3>
                </div>
                <Link href="/dashboard/add-transaction" className='btn btn-outline-secondary d-flex align-items-center justify-content-center'>
                    <i className="bi bi-cash-stack me-2"></i>
                    <span className='span-button'>Add Transaction</span>
                </Link>
            </div>

            <div className='border-bottom mb-3'></div>

            {/* Enhanced Filtering Section */}
            <div className='row mb-3'>
                <div className='col-12'>
                    <div className='card'>
                        <div className='card-body p-3'>
                            <div className='row g-3'>
                                <div className='col-md-3'>
                                    <label className='form-label fw-bold small mb-1'>Date Range</label>
                                    <select
                                        className='form-select form-select-sm'
                                        value={dateRange}
                                        onChange={(e) => setDateRange(e.target.value)}
                                    >
                                        <option value='all'>All Time</option>
                                        <option value='today'>Today</option>
                                        <option value='week'>Last 7 Days</option>
                                        <option value='month'>Last 30 Days</option>
                                        <option value='custom'>Custom Range</option>
                                    </select>
                                </div>

                                {dateRange === 'custom' && (
                                    <>
                                        <div className='col-md-2'>
                                            <label className='form-label fw-bold small mb-1'>Start Date</label>
                                            <input
                                                type='date'
                                                className='form-control form-control-sm'
                                                value={customStartDate}
                                                onChange={(e) => setCustomStartDate(e.target.value)}
                                            />
                                        </div>
                                        <div className='col-md-2'>
                                            <label className='form-label fw-bold small mb-1'>End Date</label>
                                            <input
                                                type='date'
                                                className='form-control form-control-sm'
                                                value={customEndDate}
                                                onChange={(e) => setCustomEndDate(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className='col-md-3'>
                                    <label className='form-label fw-bold small mb-1'>Type</label>
                                    <select
                                        className='form-select form-select-sm'
                                        value={transactionTypeFilter}
                                        onChange={(e) => setTransactionTypeFilter(e.target.value)}
                                    >
                                        <option value='all'>All Transactions</option>
                                        <option value='income'>Income Only</option>
                                        <option value='expense'>Expenses Only</option>
                                    </select>
                                </div>

                                <div className='col-md-3'>
                                    <label className='form-label fw-bold small mb-1'>Search</label>
                                    <input
                                        type='text'
                                        className='form-control form-control-sm'
                                        placeholder='Search description, category...'
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className='col-md-1 d-flex align-items-end'>
                                    <button
                                        className='btn btn-sm btn-outline-secondary w-100'
                                        onClick={clearFilters}
                                        title='Clear Filters'
                                    >
                                        <i className='bi bi-x-circle'></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Statistics Cards */}
            <div className='row mb-4'>
                <div className='col-md-4'>
                    <div className='card bg-success text-white'>
                        <div className='card-body py-3'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <small className='opacity-75'>Total Income</small>
                                    <h4 className='mb-0 fw-bold'>MYR {getFilteredStats().income.toFixed(2)}</h4>
                                </div>
                                <i className='bi bi-arrow-down-circle fs-2 opacity-50'></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='col-md-4'>
                    <div className='card bg-danger text-white'>
                        <div className='card-body py-3'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <small className='opacity-75'>Total Expenses</small>
                                    <h4 className='mb-0 fw-bold'>MYR {getFilteredStats().expenses.toFixed(2)}</h4>
                                </div>
                                <i className='bi bi-arrow-up-circle fs-2 opacity-50'></i>
                            </div>
                        </div>
                    </div>
                </div>
                {/* <div className='col-md-3'>
                    <div className={`card ${getFilteredStats().net >= 0 ? 'bg-primary' : 'bg-warning'} text-white`}>
                        <div className='card-body py-3'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <small className='opacity-75'>Net Balance</small>
                                    <h4 className='mb-0 fw-bold'>
                                        {getFilteredStats().net >= 0 ? '+' : ''}MYR {getFilteredStats().net.toFixed(2)}
                                    </h4>
                                </div>
                                <i className='bi bi-calculator fs-2 opacity-50'></i>
                            </div>
                        </div>
                    </div>
                </div> */}
                <div className='col-md-4'>
                    <div className='card bg-secondary text-white'>
                        <div className='card-body py-3'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <small className='opacity-75'>Transactions</small>
                                    <h4 className='mb-0 fw-bold'>{getFilteredStats().count}</h4>
                                </div>
                                <i className='bi bi-list-ul fs-2 opacity-50'></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='card p-4 mb-3'>
                <div className='row mb-3'>
                    <div className='d-flex align-items-center justify-content-end'>
                        <h5 className='fw-bold text-success p-0 m-0 me-2'>TOTAL: </h5>
                        <h5 className='p-0 m-0 text-success'>MYR {getGrandTotal().toFixed(2)}</h5>
                    </div>
                </div>
                <div className="row d-flex justift-content-between transaction-charts-row mb-4">
                    <div className="col-12 col-md-6 col-lg-4 mb-3 mb-lg-0">
                        <div className="card" style={{background: 'blue'}}>
                            <div className="card-body">
                                <div className="row">
                                    <div className="col-3 d-flex align-items-center justify-content-center">
                                        <i className="bi bi-wallet text-white fs-1"></i>
                                    </div>
                                    <div className="col-9">
                                        <h5 className="large fw-bold text-white">E-Wallet</h5>
                                        <h5 className="text-white small">MYR {getTotalByCategory('Card').toFixed(2)}</h5>
                                    </div>
                                </div>
                                <div className='d-flex justify-content-center' style={{height: '300px'}}>
                                    <Pie className={'d-flex justify-content-center'} {...ewalletPie} />
                                </div>

                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-6 col-lg-4 mb-3 mb-lg-0">
                        <div className="card bg-success">
                            <div className="card-body">
                                <div className="row">
                                    <div className="col-3 d-flex align-items-center justify-content-center">
                                        <i className="bi bi-cash text-white fs-1"></i>
                                    </div>
                                    <div className="col-9">
                                        <h5 className="large fw-bold text-white">CASH</h5>
                                        <h5 className="text-white small">MYR {getTotalByCategory('Cash').toFixed(2)}</h5>
                                    </div>
                                </div>
                                <div className='d-flex justify-content-center' style={{height: '300px'}}>
                                    <Pie className={'d-flex justify-content-center'} {...cashPie} />
                                </div>

                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-6 col-lg-4">
                        <div className="card bg-danger">
                            <div className="card-body">
                                <div className="row">
                                    <div className="col-3 d-flex align-items-center justify-content-center">
                                        <i className="bi bi-credit-card text-white fs-1"></i>
                                    </div>
                                    <div className="col-9">
                                        <h5 className="large fw-bold text-white">CARD</h5>
                                        <h5 className="text-white small">MYR {getTotalByCategory('Card').toFixed(2)}</h5>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-12 justify-content-center align-items-center" style={{ height: '300px' }}>
                                        <Pie className={'d-flex justify-content-center'} {...cardPie} />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='row mb-4 transaction-table-wrapper'>
                <div className='card p-2'>
                    <Table
                        dataSource={dataSource}
                        columns={columns}
                        loading={isLoading}
                        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} transactions` }}
                        scroll={{ x: isMobile ? 'max-content' : undefined }}
                    />
                </div>
                
            </div>
        </div>
    )
    
}