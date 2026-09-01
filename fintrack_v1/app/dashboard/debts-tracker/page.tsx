"use client"

import React from 'react'
import Swal from 'sweetalert2';
import { useState, useEffect } from "react"
import { Table, Tooltip, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { setupMoneyInput } from '@/lib/input-helpers';

interface Debt {
    debt_id: number;
    debt_type: string;
    created_date: string;
    due_date: string | null;
    person_name: string;
    amount: number;
    notes: string | null;
    status: string;
    settled_date: string | null;
}

export default function DebtsTracker() {
    const [pendingDebts, setPendingDebts] = useState<Debt[]>([])
    const [settledDebts, setSettledDebts] = useState<Debt[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [pendingFilter, setPendingFilter] = useState<string>('all')
    const [settledFilter, setSettledFilter] = useState<string>('all')
    const [isMobile, setIsMobile] = useState(false)

    // Fetch pending debts
    const fetchPendingDebts = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/debts?status=pending');
            const data = await response.json();
            setPendingDebts(data);
        } catch (error) {
            console.error('Failed to fetch pending debts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch settled debts
    const fetchSettledDebts = async () => {
        try {
            const response = await fetch('/api/debts?status=settled');
            const data = await response.json();
            setSettledDebts(data);
        } catch (error) {
            console.error('Failed to fetch settled debts:', error);
        }
    };

    useEffect(() => {
        fetchPendingDebts();
        fetchSettledDebts();
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

    // Calculate totals
    const getTotalPayables = () => {
        return pendingDebts
            .filter(d => d.debt_type === 'payable')
            .reduce((sum, d) => sum + d.amount, 0);
    };

    const getTotalReceivables = () => {
        return pendingDebts
            .filter(d => d.debt_type === 'receivable')
            .reduce((sum, d) => sum + d.amount, 0);
    };

    // Filter debts based on selected filter
    const getFilteredPendingDebts = () => {
        if (pendingFilter === 'all') return pendingDebts;
        return pendingDebts.filter(d => d.debt_type === pendingFilter);
    };

    const getFilteredSettledDebts = () => {
        if (settledFilter === 'all') return settledDebts;
        return settledDebts.filter(d => d.debt_type === settledFilter);
    };

    // Get badge color based on debt type
    const getDebtTypeBadge = (type: string) => {
        return type === 'payable'
            ? <span className="badge bg-danger">Payable</span>
            : <span className="badge bg-success">Receivable</span>;
    };

    // Check if debt is overdue
    const isOverdue = (dueDate: string | null) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    };

    const addDebt = async() => {
        const result = await Swal.fire({
            title: 'Add New Debt',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Debt Type <span class='text-danger'>*</span></label>
                        <select id='debt-type' class='form-select'>
                            <option value=''>Select type</option>
                            <option value='payable'>Payable (I owe money)</option>
                            <option value='receivable'>Receivable (Someone owes me)</option>
                        </select>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Person Name <span class='text-danger'>*</span></label>
                        <input id='person-name' type='text' class='form-control' placeholder='Enter person name'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Amount (MYR) <span class='text-danger'>*</span></label>
                        <div class='input-group'>
                            <span class='input-group-text'>MYR</span>
                            <input id='amount' type='text' class='form-control' placeholder='0.00'></input>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Created Date <span class='text-danger'>*</span></label>
                        <input id='created-date' type='date' class='form-control' value='${new Date().toISOString().split('T')[0]}'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Due Date (Optional)</label>
                        <input id='due-date' type='date' class='form-control'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Notes</label>
                        <textarea id='notes' class='form-control' rows='3' placeholder='Add any additional notes...'></textarea>
                    </div>
                </div>
            `,
            width: '700px',
            focusConfirm: false,
            confirmButtonText: "Add Debt",
            allowEscapeKey: false,
            allowOutsideClick: false,
            confirmButtonColor: "#28a745",
            showCancelButton: true,
            cancelButtonText: "Cancel",
            didOpen: () => {
                const amountInput = document.getElementById('amount') as HTMLInputElement;
                if (amountInput) setupMoneyInput(amountInput);
            },
            preConfirm: () => {
                const debtType = (document.getElementById('debt-type') as HTMLSelectElement).value;
                const personName = (document.getElementById('person-name') as HTMLInputElement).value;
                const amount = (document.getElementById('amount') as HTMLInputElement).value;
                const createdDate = (document.getElementById('created-date') as HTMLInputElement).value;
                const dueDate = (document.getElementById('due-date') as HTMLInputElement).value;
                const notes = (document.getElementById('notes') as HTMLTextAreaElement).value;

                if (!debtType || !personName || !amount || !createdDate) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    debt_type: debtType,
                    person_name: personName,
                    amount: parseFloat(amount),
                    created_date: createdDate,
                    due_date: dueDate || null,
                    notes: notes || null,
                    status: 'pending'
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/debts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Debt added successfully', 'success');
                    fetchPendingDebts();
                } else {
                    Swal.fire('Error!', 'Failed to add debt', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to add debt', 'error');
            }
        }
    }

    const editDebt = async(debt: Debt) => {
        const result = await Swal.fire({
            title: 'Edit Debt',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Debt Type <span class='text-danger'>*</span></label>
                        <select id='edit-debt-type' class='form-select'>
                            <option value='payable' ${debt.debt_type === 'payable' ? 'selected' : ''}>Payable (I owe money)</option>
                            <option value='receivable' ${debt.debt_type === 'receivable' ? 'selected' : ''}>Receivable (Someone owes me)</option>
                        </select>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Person Name <span class='text-danger'>*</span></label>
                        <input id='edit-person-name' type='text' class='form-control' value='${debt.person_name}'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Amount (MYR) <span class='text-danger'>*</span></label>
                        <div class='input-group'>
                            <span class='input-group-text'>MYR</span>
                            <input id='edit-amount' type='text' class='form-control' value='${debt.amount ? debt.amount.toFixed(2) : ''}'></input>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Created Date <span class='text-danger'>*</span></label>
                        <input id='edit-created-date' type='date' class='form-control' value='${debt.created_date}'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Due Date (Optional)</label>
                        <input id='edit-due-date' type='date' class='form-control' value='${debt.due_date || ''}'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Notes</label>
                        <textarea id='edit-notes' class='form-control' rows='3'>${debt.notes || ''}</textarea>
                    </div>
                </div>
            `,
            width: '700px',
            focusConfirm: false,
            confirmButtonText: "Update",
            allowEscapeKey: false,
            allowOutsideClick: false,
            confirmButtonColor: "#28a745",
            showCancelButton: true,
            cancelButtonText: "Cancel",
            didOpen: () => {
                const amountInput = document.getElementById('edit-amount') as HTMLInputElement;
                if (amountInput) setupMoneyInput(amountInput);
            },
            preConfirm: () => {
                const debtType = (document.getElementById('edit-debt-type') as HTMLSelectElement).value;
                const personName = (document.getElementById('edit-person-name') as HTMLInputElement).value;
                const amount = (document.getElementById('edit-amount') as HTMLInputElement).value;
                const createdDate = (document.getElementById('edit-created-date') as HTMLInputElement).value;
                const dueDate = (document.getElementById('edit-due-date') as HTMLInputElement).value;
                const notes = (document.getElementById('edit-notes') as HTMLTextAreaElement).value;

                if (!debtType || !personName || !amount || !createdDate) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    debt_id: debt.debt_id,
                    debt_type: debtType,
                    person_name: personName,
                    amount: parseFloat(amount),
                    created_date: createdDate,
                    due_date: dueDate || null,
                    notes: notes || null,
                    status: debt.status,
                    settled_date: debt.settled_date
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/debts', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Debt updated successfully', 'success');
                    if (debt.status === 'settled') {
                        fetchSettledDebts();
                    } else {
                        fetchPendingDebts();
                    }
                } else {
                    Swal.fire('Error!', 'Failed to update debt', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to update debt', 'error');
            }
        }
    }

    const settleDebt = async(debt: Debt) => {
        const result = await Swal.fire({
            title: 'Settle Debt',
            html: `
                <div class='text-start'>
                    <p>Mark this debt as settled?</p>
                    <p><strong>Person:</strong> ${debt.person_name}</p>
                    <p><strong>Amount:</strong> MYR ${debt.amount.toFixed(2)}</p>
                    <div class='mb-4'>
                        <label class='form-label'>Settled Date <span class='text-danger'>*</span></label>
                        <input id='settled-date' type='date' class='form-control' value='${new Date().toISOString().split('T')[0]}'></input>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, settle it!',
            cancelButtonText: 'Cancel',
            allowEscapeKey: false,
            allowOutsideClick: false,
            preConfirm: () => {
                const settledDate = (document.getElementById('settled-date') as HTMLInputElement).value;

                if (!settledDate) {
                    Swal.showValidationMessage('Please select a settled date');
                    return false;
                }

                return { settledDate };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/debts', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        debt_id: debt.debt_id,
                        debt_type: debt.debt_type,
                        person_name: debt.person_name,
                        amount: debt.amount,
                        created_date: debt.created_date,
                        due_date: debt.due_date,
                        notes: debt.notes,
                        status: 'settled',
                        settled_date: result.value.settledDate
                    })
                });

                if (response.ok) {
                    Swal.fire('Settled!', 'Debt marked as settled', 'success');
                    fetchPendingDebts();
                    fetchSettledDebts();
                } else {
                    Swal.fire('Error!', 'Failed to settle debt', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to settle debt', 'error');
            }
        }
    }

    const deleteDebt = async(debt_id: number, person_name: string) => {
        const result = await Swal.fire({
            title: 'Delete Debt?',
            text: `Are you sure you want to delete the debt with "${person_name}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/debts?id=${debt_id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    Swal.fire('Deleted!', 'Debt has been deleted.', 'success');
                    fetchPendingDebts();
                    fetchSettledDebts();
                } else {
                    Swal.fire('Error!', 'Failed to delete debt', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete debt', 'error');
            }
        }
    }

    // Columns for pending debts table
    const pendingColumns: TableColumnsType<Debt> = [
        {
            title: 'Type',
            dataIndex: 'debt_type',
            key: 'debt_type',
            render: (type) => getDebtTypeBadge(type)
        },
        {
            title: 'Date',
            dataIndex: 'created_date',
            key: 'created_date',
            render: (date) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Due Date',
            dataIndex: 'due_date',
            key: 'due_date',
            render: (date) => date ? (
                <span className={isOverdue(date) ? 'text-danger fw-bold' : ''}>
                    {new Date(date).toLocaleDateString()}
                    {isOverdue(date) && ' (Overdue)'}
                </span>
            ) : '-'
        },
        {
            title: 'Person',
            dataIndex: 'person_name',
            key: 'person_name',
        },
        {
            title: 'Amount (MYR)',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount) => `MYR ${amount.toFixed(2)}`
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: isMobile ? 200 : undefined,
            render: (notes) => notes || '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <div className='d-flex gap-2'>
                    <Tooltip title="Settle">
                        <button
                            className='btn btn-sm btn-success'
                            onClick={() => settleDebt(record)}
                        >
                            <i className="bi bi-check-circle"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Edit">
                        <button
                            className='btn btn-sm btn-primary'
                            onClick={() => editDebt(record)}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <button
                            className='btn btn-sm btn-danger'
                            onClick={() => deleteDebt(record.debt_id, record.person_name)}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    // Columns for settled debts table
    const settledColumns: TableColumnsType<Debt> = [
        {
            title: 'Type',
            dataIndex: 'debt_type',
            key: 'debt_type',
            render: (type) => getDebtTypeBadge(type)
        },
        {
            title: 'Date',
            dataIndex: 'created_date',
            key: 'created_date',
            render: (date) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Person',
            dataIndex: 'person_name',
            key: 'person_name',
        },
        {
            title: 'Amount (MYR)',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount) => `MYR ${amount.toFixed(2)}`
        },
        {
            title: 'Settled Date',
            dataIndex: 'settled_date',
            key: 'settled_date',
            render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: isMobile ? 200 : undefined,
            render: (notes) => notes || '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <div className='d-flex gap-2'>
                    <Tooltip title="Edit">
                        <button
                            className='btn btn-sm btn-primary'
                            onClick={() => editDebt(record)}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <button
                            className='btn btn-sm btn-danger'
                            onClick={() => deleteDebt(record.debt_id, record.person_name)}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    return (
        <div>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div className='d-flex align-items-center'>
                    <i className='bi bi-person-check fs-3 text-secondary me-2  bi-title'></i>
                    <h3 className='text-secondary p-0 m-0'><strong>Debts Tracker</strong></h3>
                </div>
                <button className="btn btn-outline-secondary d-flex align-items-center" onClick={addDebt}>
                    <i className="bi bi-plus-circle me-2"></i>
                    <span className='span-button'>Add Debt</span>
                </button>
            </div>

            <div className='border-bottom mb-3'></div>

            {/* Summary Cards */}
            <div className='row mb-3'>
                <div className='col-6 cancel-left-pad-mar'>
                    <div className='card bg-danger text-white debt-summary-cards'>
                        <div className='card-body'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <h6 className='mb-1'>Total Payables</h6>
                                    <h3 className='mb-0'>MYR {getTotalPayables().toFixed(2)}</h3>
                                    <small>Money I owe</small>
                                </div>
                                <i className="bi bi-arrow-up-circle" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='col-6 cancel-right-pad-mar'>
                    <div className='card bg-success text-white debt-summary-cards'>
                        <div className='card-body'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <h6 className='mb-1'>Total Receivables</h6>
                                    <h3 className='mb-0'>MYR {getTotalReceivables().toFixed(2)}</h3>
                                    <small>Money owed to me</small>
                                </div>
                                <i className="bi bi-arrow-down-circle" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Debts */}
            <div className="mb-3">
                <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between p-3">
                        <div className="d-flex align-items-center">
                            <i className="bi bi-exclamation-triangle me-2 text-secondary"></i>
                            <h5 className="fw-bold text-secondary p-0 m-0">Pending Debts</h5>
                        </div>
                        <Select
                            value={pendingFilter}
                            onChange={setPendingFilter}
                            style={{ width: 150 }}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'payable', label: 'Payables' },
                                { value: 'receivable', label: 'Receivables' }
                            ]}
                        />
                    </div>
                    <div className="card-body p-3">
                        <Table
                            dataSource={getFilteredPendingDebts()}
                            columns={pendingColumns}
                            loading={isLoading}
                            rowKey="debt_id"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: isMobile ? 'max-content' : undefined }}
                        />
                    </div>
                </div>
            </div>

            {/* Settled Debts */}
            <div className="mb-3">
                <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between p-3">
                        <div className="d-flex align-items-center">
                            <i className="bi bi-check-circle me-2 text-secondary"></i>
                            <h5 className="fw-bold text-secondary p-0 m-0">Settled Debts</h5>
                        </div>
                        <Select
                            value={settledFilter}
                            onChange={setSettledFilter}
                            style={{ width: 150 }}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'payable', label: 'Payables' },
                                { value: 'receivable', label: 'Receivables' }
                            ]}
                        />
                    </div>
                    <div className="card-body p-3">
                        <Table
                            dataSource={getFilteredSettledDebts()}
                            columns={settledColumns}
                            rowKey="debt_id"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: isMobile ? 'max-content' : undefined }}
                        />
                    </div>
                </div>
            </div>

        </div>
    )
}
