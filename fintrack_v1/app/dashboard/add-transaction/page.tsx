"use client";

import React from 'react';
import { Badge, Tag, Switch, Statistic, Table, Tooltip, Carousel  } from 'antd';
import { useState, useEffect } from 'react';
import type { TableProps } from 'antd';
import { Pie } from '@ant-design/plots';
import './addTransaction.css';

import Swal from 'sweetalert2';
import { Color } from 'antd/es/color-picker';
import { CreditCardOutlined } from '@ant-design/icons';
import Link from 'next/link';

// Type for account balance from database
interface AccountBalance {
    account_id: number;
    account_category: string;
    account_sub_category: string;
    account_card_type: string | null;
    current_balance: number;
}

// Type for debt from database
interface Debt {
    debt_id: number;
    debt_type: string;
    amount: number;
    status: string;
}

// Type for commitment from database
interface Commitment {
    commitment_id: number;
    commitment_per_month: number;
    commitment_status: string;
}

// Type for transaction from database
interface Transaction {
    transaction_id: number;
    transaction_date: string;
    transaction_time: string;
    transaction_description: string;
    transaction_amount: number;
    transaction_category: string;
    transaction_sub_category: string;
    transaction_income_source: string | null;
    transaction_expense_usage: string | null;
}

export default function AddTransactionPage() {

    const [transactionType, setType] = useState('income');
    const [todayDate, setTodayDate] = useState('');
    const [currentTime, setCurrentTime] = useState('');
    const [accountCategory, setAccountCategory] = useState("");
    const [accountSubCategory, setAccountSubCategory] = useState("")
    const [incomeSource, setIncomeSource] = useState("")
    const [expenseUsage, setExpenseUsage] = useState("")
    const [hobbyCategory, setHobbyCategory] = useState("")
    const [spendingBeneficiary, setSpendingBeneficiary] = useState("")
    const [description, setDescription] = useState("")
    const [cardChoice, setCardChoice] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Account balances from database
    const [accounts, setAccounts] = useState<AccountBalance[]>([])
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

    // Debts and commitments data
    const [debts, setDebts] = useState<Debt[]>([])
    const [commitments, setCommitments] = useState<Commitment[]>([])
    const [paymentStatuses, setPaymentStatuses] = useState<any[]>([])
    const [isLoadingDebts, setIsLoadingDebts] = useState(true)
    const [isLoadingCommitments, setIsLoadingCommitments] = useState(true)

    // Recent transactions
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
    const [showRecentTransactions, setShowRecentTransactions] = useState(true)

    const subCategories = {
        e_wallet: [
            { value: "tng", label: "Touch 'n Go" },
            { value: "shopeepay", label: "Shopee Pay" },
        ],
        cash: [
            { value: "notes", label: "Notes" },
            { value: "coins", label: "Coins" },
        ],
        card: [
            { value: "past", label: "Past" },
            { value: "present", label: "Present" },
            { value: "savings", label: "Savings" },
            { value: "bliss", label: "Bliss" },
        ]
    };

    const [amount, setAmount] = useState("");
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, ""); // remove non-digits
        setAmount(rawValue);
    };
    const displayValue = amount ? (parseInt(amount) / 100).toFixed(2) : "";

    const past = parseFloat((Number(displayValue) * 0.3).toFixed(2));
    const present = parseFloat((Number(displayValue) * 0.4).toFixed(2));
    const savings = parseFloat((Number(displayValue) * 0.2).toFixed(2));
    const bliss = parseFloat((Number(displayValue) * 0.1).toFixed(2));

    const grandTotal = parseFloat((past + present + savings + bliss).toFixed(2));
    
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

    // Fetch debts from database
    const fetchDebts = async () => {
        try {
            setIsLoadingDebts(true);
            const response = await fetch('/api/debts?status=pending');
            const data = await response.json();
            setDebts(data);
        } catch (error) {
            console.error('Failed to fetch debts:', error);
        } finally {
            setIsLoadingDebts(false);
        }
    };

    // Fetch commitments from database
    const fetchCommitments = async () => {
        try {
            setIsLoadingCommitments(true);
            const response = await fetch('/api/commitments');
            const data = await response.json();
            setCommitments(data);
        } catch (error) {
            console.error('Failed to fetch commitments:', error);
        } finally {
            setIsLoadingCommitments(false);
        }
    };

    // Fetch commitment payment statuses
    const fetchPaymentStatuses = async () => {
        try {
            const response = await fetch('/api/commitment-payments');
            const data = await response.json();
            setPaymentStatuses(data);
        } catch (error) {
            console.error('Failed to fetch payment statuses:', error);
        }
    };

    // Fetch recent transactions (last 5)
    const fetchRecentTransactions = async () => {
        try {
            const response = await fetch('/api/transactions');
            const data = await response.json();
            // Get last 5 transactions, sorted by date and time
            const sorted = data.sort((a: Transaction, b: Transaction) => {
                const dateA = new Date(`${a.transaction_date} ${a.transaction_time}`);
                const dateB = new Date(`${b.transaction_date} ${b.transaction_time}`);
                return dateB.getTime() - dateA.getTime();
            }).slice(0, 5);
            setRecentTransactions(sorted);
        } catch (error) {
            console.error('Failed to fetch recent transactions:', error);
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

    const getTotalByCategory = (category: string) => {
        return accounts
            .filter(acc => acc.account_category === category)
            .reduce((sum, acc) => sum + acc.current_balance, 0);
    };

    const getGrandTotal = () => {
        return accounts.reduce((sum, acc) => sum + acc.current_balance, 0);
    };

    // Calculate total payables (money I owe)
    const getTotalPayables = () => {
        return debts
            .filter(d => d.debt_type === 'payable' && d.status === 'pending')
            .reduce((sum, d) => sum + d.amount, 0);
    };

    // Calculate unpaid commitments for current month
    const getUnpaidCommitmentsCount = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return commitments.filter(c => {
            if (c.commitment_status !== 'Active') return false;

            // Check if payment status exists for this month
            const paymentStatus = paymentStatuses.find(
                ps => ps.commitment_id === c.commitment_id &&
                      ps.payment_month === currentMonth &&
                      ps.payment_year === currentYear
            );

            return !paymentStatus || paymentStatus.payment_status === 0;
        }).length;
    };

    // Get today's transactions stats
    const getTodayStats = () => {
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = recentTransactions.filter(t => t.transaction_date === today);

        const income = todayTransactions
            .filter(t => t.transaction_income_source !== null)
            .reduce((sum, t) => sum + t.transaction_amount, 0);

        const expenses = todayTransactions
            .filter(t => t.transaction_expense_usage !== null)
            .reduce((sum, t) => sum + t.transaction_amount, 0);

        return {
            income,
            expenses,
            net: income - expenses,
            count: todayTransactions.length
        };
    };

    // Format time from HH:MM to 12-hour format
    const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
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
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
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
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
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
        tooltip: (d: any) => ({
            name: d.type,
            value: `MYR ${d.value.toFixed(2)}`,
        }),
    }

    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();

            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            setTodayDate(`${yyyy}-${mm}-${dd}`);

            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            setCurrentTime(`${hh}:${min}`);
        };

        updateDateTime(); // initial call
        const interval = setInterval(updateDateTime, 1000 * 60); // update every minute

        return () => clearInterval(interval);
    }, []);

    // Fetch accounts on component mount
    useEffect(() => {
        fetchAccounts();
        fetchDebts();
        fetchCommitments();
        fetchPaymentStatuses();
        fetchRecentTransactions();
    }, []);

    // Helper to map form values to database values
    const mapCategoryToDb = (category: string) => {
        const mapping: Record<string, string> = {
            'e_wallet': 'E-Wallet',
            'cash': 'Cash',
            'card': 'Card'
        };
        return mapping[category] || category;
    };

    const mapSubCategoryToDb = (subCategory: string) => {
        const mapping: Record<string, string> = {
            'tng': "Touch 'n Go",
            'shopeepay': 'Shopee Pay',
            'notes': 'Notes',
            'coins': 'Coins',
            'past': 'Past',
            'present': 'Present',
            'savings': 'Savings',
            'bliss': 'Bliss'
        };
        return mapping[subCategory] || subCategory;
    };

    const resetForm = () => {
        setAmount("");
        setDescription("");
        setAccountCategory("");
        setAccountSubCategory("");
        setCardChoice("");
        setIncomeSource("");
        setExpenseUsage("");
        setHobbyCategory("");
        setSpendingBeneficiary("");
    };

    // Check if form is valid for submission
    const isFormValid = () => {
        // Basic required fields
        if (!description.trim()) return false;
        if (!displayValue || Number(displayValue) <= 0) return false;
        if (!accountCategory) return false;
        if (!accountSubCategory) return false;

        // // Card category requires card choice
        // if (accountCategory === 'card' && !cardChoice) return false;

        // // Money division requires card choice
        // if (accountSubCategory === 'moneyDivision' && !cardChoice) return false;

        // Income requires source
        if (transactionType === 'income' && !incomeSource) return false;

        // Expense requires usage
        if (transactionType === 'expense' && !expenseUsage) return false;

        // Hobby expense requires hobby category
        if (expenseUsage === 'hobby' && !hobbyCategory) return false;

        return true;
    };

    const submitExpense = async () => {
        if (!isFormValid()) return;

        setIsSubmitting(true);

        try {
            const transactionAmount = Number(displayValue);
            const dbCategory = mapCategoryToDb(accountCategory);
            const dbSubCategory = mapSubCategoryToDb(accountSubCategory);

            // Handle Money Division for income (splits into Past/Present/Savings/Bliss)
            if (transactionType === 'income' && accountSubCategory === 'moneyDivision') {
                // Create 4 transactions for each division type
                const divisions = [
                    { type: 'Past', amount: past },
                    { type: 'Present', amount: present },
                    { type: 'Savings', amount: savings },
                    { type: 'Bliss', amount: bliss }
                ];

                for (const division of divisions) {
                    // Create transaction
                    await fetch('/api/transactions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            transaction_date: todayDate,
                            transaction_time: currentTime,
                            transaction_description: `${description} (${division.type})`,
                            transaction_amount: division.amount,
                            transaction_category: 'Card',
                            transaction_sub_category: division.type,
                            transaction_card_choice: cardChoice || 'RHB',
                            transaction_income_source: incomeSource,
                            transaction_expense_usage: null,
                            transaction_hobby_category: null
                        })
                    });

                    // Update account balance - sub_category is division type, card_type is bank
                    const account = accounts.find(
                        acc => acc.account_category === 'Card' &&
                               acc.account_sub_category === division.type &&
                               acc.account_card_type === (cardChoice || 'RHB')
                    );
                    if (account) {
                        const newBalance = parseFloat((account.current_balance + division.amount).toFixed(2));
                        await fetch('/api/accounts', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                account_id: account.account_id,
                                current_balance: newBalance
                            })
                        });
                    }
                }
            } else {
                // Single transaction
                await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transaction_date: todayDate,
                        transaction_time: currentTime,
                        transaction_description: description,
                        transaction_amount: transactionAmount,
                        transaction_category: dbCategory,
                        transaction_sub_category: dbSubCategory,
                        transaction_card_choice: accountCategory === 'card' ? (cardChoice || 'RHB') : null,
                        transaction_income_source: transactionType === 'income' ? incomeSource : null,
                        transaction_expense_usage: transactionType === 'expense' ? expenseUsage : null,
                        transaction_hobby_category: expenseUsage === 'hobby' ? hobbyCategory : null,
                        transaction_spending_beneficiary: transactionType === 'expense' && spendingBeneficiary ? spendingBeneficiary : null
                    })
                });

                // Update account balance
                let account: AccountBalance | undefined;
                if (accountCategory === 'card') {
                    // For card: sub_category is division type (Past/Present/etc), card_type is bank (RHB)
                    account = accounts.find(
                        acc => acc.account_category === 'Card' &&
                               acc.account_sub_category === dbSubCategory &&
                               acc.account_card_type === (cardChoice || 'RHB')
                    );
                } else {
                    account = accounts.find(
                        acc => acc.account_category === dbCategory &&
                               acc.account_sub_category === dbSubCategory
                    );
                }

                if (account) {
                    const calculatedBalance = transactionType === 'income'
                        ? account.current_balance + transactionAmount
                        : account.current_balance - transactionAmount;
                    const newBalance = parseFloat(calculatedBalance.toFixed(2));

                    await fetch('/api/accounts', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            account_id: account.account_id,
                            current_balance: newBalance
                        })
                    });
                }
            }

            // Refresh accounts, recent transactions and reset form
            await fetchAccounts();
            await fetchRecentTransactions();
            resetForm();

            Swal.fire({
                icon: 'success',
                title: 'Successfully added',
                text: `${transactionType === 'income' ? 'Income' : 'Expense'} of MYR ${displayValue} recorded`
            });
        } catch (error) {
            console.error('Failed to submit transaction:', error);
            Swal.fire({
                icon: 'error',
                title: 'Failed to add transaction',
                text: 'Please try again'
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div>
            <div className='d-flex align-items-center title-pages '>
                <i className='bi bi-currency-dollar fs-3 text-secondary me-2 bi-title'></i>
                <h3 className='text-secondary m-0 p-0'>Add Transactions (Income/Expense)</h3>
            </div>

            <div className='border-bottom my-3'></div>

            {/* Today's Stats Summary Bar */}
            <div className='row mb-3'>
                <div className='col-12'>
                    <div className='card bg-light'>
                        <div className='card-body py-2'>
                            <div className='row text-center mb-2'>
                                <div className='col-4 d-flex align-items-center justify-content-center'>
                                    <small className='text-muted'>Today's Income</small>
                                </div>
                                <div className='col-4  d-flex align-items-center justify-content-center'>
                                    <small className='text-muted'>Today's Expenses</small>
                                </div>
                                {/* <div className='col-3'>
                                    <small className='text-muted'>Net Balance</small>
                                    <h5 className={`mb-0 fw-bold ${getTodayStats().net >= 0 ? 'text-primary' : 'text-warning'}`}>
                                        {getTodayStats().net >= 0 ? '+' : ''}MYR {getTodayStats().net.toFixed(2)}
                                    </h5>
                                </div> */}
                                <div className='col-4  d-flex align-items-center justify-content-center'>
                                    <small className='text-muted'>Transactions</small>
                                </div>
                            </div>
                            <div className='row text-center'>
                                <div className='col-4 d-flex align-items-center justify-content-center'>
                                    <h5 className='mb-0 text-success fw-bold'>+MYR {getTodayStats().income.toFixed(2)}</h5>
                                </div>
                                <div className='col-4 d-flex align-items-center justify-content-center'>
                                    <h5 className='mb-0 text-danger fw-bold'>-MYR {getTodayStats().expenses.toFixed(2)}</h5>
                                </div>
                                {/* <div className='col-3'>
                                    <small className='text-muted'>Net Balance</small>
                                    <h5 className={`mb-0 fw-bold ${getTodayStats().net >= 0 ? 'text-primary' : 'text-warning'}`}>
                                        {getTodayStats().net >= 0 ? '+' : ''}MYR {getTodayStats().net.toFixed(2)}
                                    </h5>
                                </div> */}
                                <div className='col-4 d-flex align-items-center justify-content-center'>
                                    <h5 className='mb-0 text-secondary fw-bold'>{getTodayStats().count}</h5>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className='row mb-4 debt-commitment-cards'>
                <div className='col-12 col-md-6 mb-3 mb-md-0'>
                    <div className='card bg-danger text-white h-100'>
                        <div className='card-body d-flex flex-column'>
                            <div className='d-flex justify-content-between align-items-center flex-grow-1'>
                                <div>
                                    <h6 className='mb-1'>Total Debt (Payables)</h6>
                                    <h3 className='mb-0'>MYR {getTotalPayables().toFixed(2)}</h3>
                                    <small>Money you owe</small>
                                </div>
                                <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                            <div className='mt-3'>
                                <Link href="/dashboard/debts-tracker" className='d-flex align-items-center justify-content-center btn btn-sm btn-light w-100'>
                                    <i className="bi bi-arrow-right-circle me-2"></i>
                                    View Debts
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='col-12 col-md-6'>
                    <div className='card bg-warning text-dark h-100'>
                        <div className='card-body d-flex flex-column'>
                            <div className='d-flex justify-content-between align-items-center flex-grow-1'>
                                <div>
                                    <h6 className='mb-1'>Unpaid Commitments</h6>
                                    <h3 className='mb-0'>{getUnpaidCommitmentsCount()} items</h3>
                                    <small>For this month</small>
                                </div>
                                <i className="bi bi-calendar-x" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                            <div className='mt-3'>
                                <Link href="/dashboard/commitment" className='d-flex align-items-center justify-content-center btn btn-sm btn-dark w-100'>
                                    <i className="bi bi-arrow-right-circle me-2"></i>
                                    View Commitments
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='row transaction-form-container'>
                <div className='col-12 col-lg-8 mb-4 mb-lg-0 cancel-col'>
                    <div className='card mb-4'>
                        <div className='cancel-dflex card-header d-flex align-items-center justify-content-between'>
                            <h5 className='m-0 p-0 py-2'>Add {transactionType === 'income' ? 'Incomes' : 'Expenses'}</h5>

                            <div className="btn-group cancel-col" role="group">
                                <button type="button" className={`btn ${transactionType === 'income' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setType('income')}>
                                    Income
                                </button>
                                <button type="button" className={`btn ${transactionType === 'expense' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => setType('expense')}>
                                    Expense
                                </button>
                            </div>
                        </div>
                        <div className='card-body'>
                            <div className='row mb-4'>
                                <div className='col-6 d-flex align-items-center cancel-dflex'>
                                    <span className='form-label m-0 p-0 me-2'>Date</span>
                                    <input type='date' className='form-control' value={todayDate} disabled></input>
                                </div>

                                <div className='col-6 d-flex align-items-center cancel-dflex'>
                                    <label className='form-label m-0 p-0 me-2'>Time</label>
                                    <input type='time' className='form-control' value={currentTime} disabled></input>
                                </div>
                            </div>
                            <div className='row mb-5'>
                                <div className='col d-flex align-items-center cancel-dflex'>
                                    <label className='form-label me-2'>Description</label>
                                    <textarea className='form-control' placeholder={transactionType === 'income' ? 'Enter incomes description...' : 'Enter expenses description...'} value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
                                </div>
                            </div>

                            <h5 className='text-secondary mb-3'>{transactionType === 'income' ? 'Incomes Details' : 'Expenses Detail'}</h5>

                            {transactionType === 'income' && (
                                <div className='row mb-5'>
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2 cancel-col'>
                                            <label className=''>Amount</label>
                                        </div>

                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <div className='input-group flex-nowrap' role='group'>
                                                <span className='input-group-text'>MYR</span>
                                                <input className='form-control' type='number' step="0.01" value={displayValue} placeholder='Enter amount' onChange={handleChange}></input>
                                            </div>
                                        </div>
                                        
                                    </div>
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2'>
                                            <label className='form-label p-0 m-0 me-2'>Category</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <select className='form-select' value={accountCategory} onChange={(e) => setAccountCategory(e.target.value)}>
                                                <option value="" disabled hidden>Select category</option>
                                                <option value="e_wallet">E-Wallet</option>
                                                <option value="cash">Cash</option>
                                                <option value="card">Card</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* {accountCategory === 'card' && (
                                        <div>
                                            <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                                <div className='col-4 col-sm-3 col-md-2'>
                                                    <label className='form-label p-0 m-0 me-2'>Card</label>
                                                </div>
                                                <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                                    <select className='form-select' value={cardChoice} onChange={(e) => setCardChoice(e.target.value)}>
                                                        <option value="" disabled hidden>Select card</option>
                                                        <option value="RHB">RHB</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>

                                            </div>
                                        </div>

                                    )} */}
                                    
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2'>
                                            <label className='form-label p-0 m-0 me-2'>Sub-category</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <select className='form-select' value={accountSubCategory} onChange={(e) => setAccountSubCategory(e.target.value)} disabled={!accountCategory}>
                                                <option value="" disabled hidden>Select sub-category</option>
                                                {subCategories[accountCategory as "e_wallet" | "cash" | "card"]?.map(item => (
                                                    <option key={item.value} value={item.value}>
                                                        {item.label}
                                                    </option>
                                                ))}
                                                {accountCategory === 'card' && (
                                                    <option value="moneyDivision">Money Division</option>
                                                )}
                                            </select>

                                        </div>
                                    </div>

                                    {accountSubCategory === 'moneyDivision' && (
                                        <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                            <div className='col-4 col-sm-3 col-md-2'></div>
                                            <div className='col-8 col-sm-9 col-md-10  cancel-col'>
                                                <div className='d-flex align-items-center my-4'>
                                                    <Table 
                                                        className='w-100 border rounded'
                                                        pagination={false}
                                                        columns={
                                                            [
                                                                {
                                                                    title: 'Division Type',
                                                                    dataIndex: 'divisionType',
                                                                    key: 'divisionType',
                                                                },
                                                                {
                                                                    title: 'Division Percentage',
                                                                    dataIndex: 'divisionPercentage',
                                                                    key: 'divisionPercentage',
                                                                },
                                                                {
                                                                    title: 'Total Division',
                                                                    dataIndex: 'totalDivision',
                                                                    key: 'totalDivision',
                                                                },
                                                            ]
                                                        }
                                                        dataSource={
                                                            [
                                                                {
                                                                    key: '1',
                                                                    divisionType: 'Past',
                                                                    divisionPercentage: '30%',
                                                                    totalDivision: past.toFixed(2),
                                                                },
                                                                {
                                                                    key: '2',
                                                                    divisionType: 'Present',
                                                                    divisionPercentage: '40%',
                                                                    totalDivision: present.toFixed(2),
                                                                },
                                                                {
                                                                    key: '3',
                                                                    divisionType: 'Savings',
                                                                    divisionPercentage: '20%',
                                                                    totalDivision: savings.toFixed(2),
                                                                },
                                                                {
                                                                    key: '4',
                                                                    divisionType: 'Bliss',
                                                                    divisionPercentage: '10%',
                                                                    totalDivision: bliss.toFixed(2),
                                                                },
                                                                {
                                                                    key: '5',
                                                                    divisionType: <strong className='fw-bold text-uppercase'>Total</strong>,
                                                                    divisionPercentage: '',
                                                                    totalDivision: <span className='text-primary fw-bold'>{'MYR ' + grandTotal.toFixed(2)}</span>
                                                                },
                                                            ]
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2'>
                                            <label className='form-label p-0 m-0 me-2'>Source</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <select className='form-select' value={incomeSource} onChange={(e) => setIncomeSource(e.target.value)} disabled={!accountCategory}>
                                                <option value="" disabled hidden>Select source</option>
                                                <option value="salary">Salary</option>
                                                <option value="allowance_gift">Allowance / Gift</option>
                                                <option value="paybank_reimbursement">Payback / Reimbursement</option>
                                                <option value="kwsp">KWSP</option>
                                                <option value="transfer">Transfer</option>
                                                <option value="bank_profit">Bank Profit</option>
                                                <option value="borrow">Borrow</option>
                                                <option value="refund">Refund</option>
                                                <option value="tally">Tally</option>
                                                <option value="update">Update</option>
                                                <option value="move_money">Move Money</option>
                                                <option value="others">Others</option>
                                            </select>

                                        </div>
                                    </div>
                                </div>
                            )}

                            {transactionType === 'expense' && (
                                <div className='row mb-5'>
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2 cancel-col'>
                                            <label className=''>Amount</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <div className='input-group flex-nowrap'>
                                                <span className='input-group-text'>MYR</span>
                                                <input className='form-control' type='number' step="0.01" value={displayValue} placeholder='Enter amount' onChange={handleChange}></input>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2'>
                                            <label className='form-label p-0 m-0 me-2'>Category</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <select className='form-select' value={accountCategory} onChange={(e) => setAccountCategory(e.target.value)}>
                                                <option value="" disabled hidden>Select category</option>
                                                <option value="e_wallet">E-Wallet</option>
                                                <option value="cash">Cash</option>
                                                <option value="card">Card</option>
                                            </select>
                                        </div>
                                    </div>
                                    {/* {accountCategory === 'card' && (
                                        <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                            <div className='col-4 col-sm-3 col-md-2'>
                                                <label className='form-label p-0 m-0 me-2'>Card</label>
                                            </div>
                                            <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                                <select className='form-select' value={cardChoice} onChange={(e) => setCardChoice(e.target.value)}>
                                                    <option value="" disabled hidden>Select card</option>
                                                    <option value="RHB">RHB</option>
                                                </select>
                                            </div>
                                        </div>
                                    )} */}
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2'>
                                            <label className='form-label p-0 m-0 me-2'>Sub-category</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <select className='form-select' value={accountSubCategory} onChange={(e) => setAccountSubCategory(e.target.value)} disabled={!accountCategory}>
                                                <option value="" disabled hidden>Select sub-category</option>
                                                {subCategories[accountCategory as "e_wallet" | "cash" | "card"]?.map(item => (
                                                    <option key={item.value} value={item.value}>
                                                        {item.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2'>
                                            <label className='form-label p-0 m-0 me-2'>Usage</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <select className='form-select' value={expenseUsage} onChange={(e) => setExpenseUsage(e.target.value)} disabled={!accountCategory}>
                                                
                                                <option value="" disabled hidden>Select expense usage</option>

                                                <optgroup label="Living">
                                                    <option value="food">Food & Drinks</option>
                                                    <option value="groceries">Groceries</option>
                                                    <option value="stationaries">Stationaries</option>
                                                    <option value="health">Health</option>
                                                    <option value="household">Household</option>
                                                    <option value="personalcare">Personal Care</option>
                                                </optgroup>

                                                <optgroup label="Commitments">
                                                    <option value="car">Car</option>
                                                    <option value="house">House</option>
                                                    <option value="utilities">Utilities</option>
                                                    <option value="installment">Installment</option>
                                                    <option value="transport">Transportation</option>
                                                    <option value="subscription">Subscription</option>
                                                </optgroup>

                                                <optgroup label="Personal">
                                                    <option value="entertainment">Entertainment</option>
                                                    <option value="shopping">Shopping</option>
                                                    <option value="travel">Travel</option>
                                                    <option value="ride">Ride Transportation</option>
                                                    <option value="gifts">Gifts</option>
                                                    <option value="hobby">Hobby</option>
                                                </optgroup>

                                                <optgroup label='Financial'>
                                                    <option value="investment">Investment</option>
                                                    <option value="charity">Charity</option>
                                                    <option value="payback">Payback</option>
                                                    <option value="lend">Lend Money</option>
                                                    <option value="movement">Move Money</option>
                                                    <option value="update">Update Money</option>
                                                </optgroup>

                                                <option value="others">Others</option>
                                            </select>
                                        </div>
                                    </div>
                                    {expenseUsage === 'hobby' && (
                                        <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                            <div className='col-4 col-sm-3 col-md-2 cancel-col'>
                                                <label className='form-label p-0 m-0 me-2'>Hobby Category</label>
                                            </div>
                                            <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                                <select className='form-select' value={hobbyCategory} onChange={(e) => setHobbyCategory(e.target.value)} disabled={!accountCategory}>
                                                    <option value="">Select Hobby Category</option>
                                                    <option value="gunpla">Gunpla</option>
                                                    <option value="music">Music</option>
                                                    <option value="climbing">Climbing</option>
                                                    <option value="decoration">Decoration</option>
                                                    <option value="technology">Technology</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Spending Beneficiary - Optional */}
                                    <div className='d-flex align-items-center mb-4 cancel-dflex'>
                                        <div className='col-4 col-sm-3 col-md-2'>
                                            <label className='form-label p-0 m-0 me-2'>Spent For</label>
                                        </div>
                                        <div className='col-8 col-sm-9 col-md-10 cancel-col'>
                                            <select className='form-select' value={spendingBeneficiary} onChange={(e) => setSpendingBeneficiary(e.target.value)}>
                                                <option value="">Select who this is for (optional)</option>
                                                <option value="personal">Personal</option>
                                                <option value="family">Family</option>
                                                <option value="dating">Dating</option>
                                                <option value="friends">Friends</option>
                                                <option value="work">Work</option>
                                                <option value="charity">Charity</option>
                                                <option value="na">Not Applicable</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                </div>
                            )}

                            <div className='d-flex align-items-center justify-content-end mb-4'>
                                <button className='btn btn-primary' onClick={() => submitExpense()} disabled={!isFormValid() || isSubmitting}>{isSubmitting ? 'Submitting...' : `Submit ${transactionType}`}</button>
                            </div>
                            
                        </div>
                    </div>
                </div>


                <div className='col-4 cancel-col'>
                    <div className="card bg-secondary py-3">

                        <div className='row mb-3 px-4'>
                            <div className='d-flex align-items-center justify-content-between'>
                                <label className='fw-bold text-white'>Remainder</label>
                                <div className='d-flex align-items-center'>
                                    <label className='fw-bold' style={{ color: '#90EE90' }}>MYR {getGrandTotal().toFixed(2)}</label>
                                </div>
                            </div>
                        </div>

                        <div className='row'>
                            <Carousel arrows dots={false} className='px-4 d-flex align-items-center justify-content-center'>
                                <div className='mb-3'>
                                    <div className="card mb-3">
                                        <div className='card-header'>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div>
                                                    <CreditCardOutlined className='me-2' />
                                                    <label className="large fw-bold">CARD</label>
                                                </div>
                                                
                                                <label className="fw-bold text-success">MYR {getTotalByCategory('Card').toFixed(2)}</label>
                                            </div>
                                        </div>
                                        <div className="card-body">
                                            <div className='d-flex align-items-center justify-content-center add-transaction-pie' style={{height: '300px'}}>
                                                <Pie className={'d-flex justify-content-center'} {...cardPie} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className='mb-3'>
                                    <div className="card mb-3">
                                        <div className='card-header'>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div>
                                                    <i className="bi bi-cash me-2"></i>
                                                    <label className="large fw-bold">CASH</label>
                                                </div>
                                                
                                                <label className="fw-bold text-success">MYR {getTotalByCategory('Cash').toFixed(2)}</label>
                                            </div>
                                        </div>
                                        <div className="card-body">
                                            <div className='d-flex align-items-center justify-content-center add-transaction-pie' style={{height: '300px'}}>
                                                <Pie className={'d-flex justify-content-center'} {...cashPie} />
                                            </div>

                                        </div>
                                    </div>
                                </div>
                                <div className='mb-3'>
                                    <div className="card mb-3">
                                        <div className='card-header'>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div>
                                                    <i className="bi bi-wallet me-2"></i>
                                                    <label className="large fw-bold">E-Wallet</label>
                                                </div>
                                                
                                                <label className="fw-bold text-success">MYR {getTotalByCategory('E-Wallet').toFixed(2)}</label>
                                            </div>
                                        </div>
                                        <div className="card-body">
                                            <div className='d-flex align-items-center justify-content-center add-transaction-pie' style={{height: '300px'}}>
                                                <Pie className={'d-flex justify-content-center'} {...ewalletPie} />
                                            </div>

                                        </div>
                                    </div>
                                    
                                </div>
                            </Carousel>
                        </div>

                        <div className="row mb-3 px-4">
                            <div className="col-12">
                                <div className="p-3 rounded shadow-sm bg-success text-white">
                                
                                {/* Header */}
                                <div className="mb-2 border-bottom border-light pb-1">
                                    <h6 className="fw-bold mb-0">Notes</h6>
                                </div>

                                {/* Content */}
                                <ul className="list-unstyled mb-0 small">
                                    <li className="d-flex align-items-start">
                                        <span className="me-2">•</span>
                                        <span>
                                            <strong>Past:</strong> Maybank Savings Account
                                        </span>
                                    </li>

                                    <li className="d-flex align-items-start mb-1">
                                        <span className="me-2">•</span>
                                        <span>
                                            <strong>Present:</strong> Maybank MAE Account
                                        </span>
                                    </li>

                                    <li className="d-flex align-items-start mb-1">
                                        <span className="me-2">•</span>
                                        <span>
                                            <strong>Savings & Bliss:</strong> RHB Savings Account
                                        </span>
                                    </li>
                                </ul>

                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className='row'>
                <div className='col-12'>
                    <div className='card'>
                        <div className='card-header d-flex align-items-center justify-content-between p-3'>
                            <div className='d-flex align-items-center'>
                                <i className="bi bi-clock-history me-2 text-secondary"></i>
                                <h5 className='fw-bold text-secondary p-0 m-0'>Recent Transactions</h5>
                            </div>
                            <div className='d-flex align-items-center gap-2'>
                                <button
                                    className='btn btn-sm btn-outline-secondary d-flex align-items-center'
                                    onClick={() => setShowRecentTransactions(!showRecentTransactions)}
                                >
                                    <i className={`bi bi-chevron-${showRecentTransactions ? 'up' : 'down'}`}></i>
                                </button>
                                <Link href="/dashboard/transaction-record" className='btn btn-sm btn-primary d-flex align-items-center'>
                                    <i className="bi bi-list-ul"></i>
                                    View All
                                </Link>
                            </div>
                        </div>
                        {showRecentTransactions && (
                            <div className='card-body p-3'>
                                {recentTransactions.length === 0 ? (
                                    <div className='text-center py-4 text-muted'>
                                        <i className="bi bi-inbox fs-1"></i>
                                        <p className='mt-2'>No transactions yet. Add your first transaction above!</p>
                                    </div>
                                ) : (
                                    <div className='list-group list-group-flush'>
                                        {recentTransactions.map((transaction) => (
                                            <div key={transaction.transaction_id} className='list-group-item px-0'>
                                                <div className='d-flex justify-content-between align-items-center'>
                                                    <div className='col-8 d-flex align-items-center gap-3'>
                                                        <div className={`p-2 rounded ${transaction.transaction_income_source ? 'bg-success' : 'bg-danger'} bg-opacity-10`}>
                                                            <i className={`bi ${transaction.transaction_income_source ? 'bi-arrow-down-circle text-success' : 'bi-arrow-up-circle text-danger'} fs-4`}></i>
                                                        </div>
                                                        <div className='col-8'>
                                                            <h6 className='mb-0'>{transaction.transaction_description}</h6>
                                                            <small className='text-muted'>
                                                                {formatTime(transaction.transaction_time)} • {transaction.transaction_category} ({transaction.transaction_sub_category})
                                                            </small>
                                                        </div>
                                                    </div>
                                                    <div className='col-4 text-end'>
                                                        <h5 className={`mb-0 fw-bold ${transaction.transaction_income_source ? 'text-success' : 'text-danger'}`}>
                                                            {transaction.transaction_income_source ? '+' : '-'}MYR {transaction.transaction_amount.toFixed(2)}
                                                        </h5>
                                                        <small className='text-muted'>{new Date(transaction.transaction_date).toLocaleDateString()}</small>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    )

}