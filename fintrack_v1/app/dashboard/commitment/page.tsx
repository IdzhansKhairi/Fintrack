"use client"

import React from 'react'
import Swal from 'sweetalert2';

import { useState, useEffect } from "react"
import { Table, Checkbox, Tooltip, Spin, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { setupMoneyInput } from '@/lib/input-helpers';

interface Commitment {
    commitment_id: number;
    commitment_name: string;
    commitment_description: string | null;
    commitment_per_month: number;
    commitment_per_year: number;
    commitment_notes: string | null;
    commitment_status: string;
    commitment_start_month: number | null;
    commitment_start_year: number | null;
}

interface PaymentStatus {
    commitment_payment_id: number;
    commitment_id: number;
    payment_month: number;
    payment_year: number;
    payment_status: number;
    commitment_name?: string;
}

interface LinkedInstallment {
    commitment_id: number;
    financing_id: number;
    financing_name: string;
    installment_id: number;
    installment_amount: number;
    installment_due_date: string;
    installment_payment_status: string;
    installment_paid_date: string | null;
}

export default function CommitmentPage() {

    const [commitmentsTypeView, setCommitmentTypeView] = useState("commitment_status")
    const [commitments, setCommitments] = useState<Commitment[]>([])
    const [allCommitments, setAllCommitments] = useState<Commitment[]>([])
    const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatus[]>([])
    const [linkedInstallments, setLinkedInstallments] = useState<LinkedInstallment[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [checkboxLoading, setCheckboxLoading] = useState<number | null>(null)
    const [isMobile, setIsMobile] = useState(false)

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed (0 = January)
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

    // Toast for payment status updates
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
    });

    // Fetch commitments based on status
    const fetchCommitments = async (status?: string) => {
        try {
            setIsLoading(true);
            const url = status ? `/api/commitments?status=${status}` : '/api/commitments';
            const response = await fetch(url);
            const data = await response.json();
            setCommitments(data);
        } catch (error) {
            console.error('Failed to fetch commitments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch all commitments (for status breakdown)
    const fetchAllCommitments = async () => {
        try {
            const response = await fetch('/api/commitments');
            const data = await response.json();
            setAllCommitments(data);
        } catch (error) {
            console.error('Failed to fetch all commitments:', error);
        }
    };

    // Fetch payment statuses for selected month/year
    const fetchPaymentStatuses = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/commitment-payments?month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setPaymentStatuses(data);
            } else {
                console.error('API returned non-array:', data);
                setPaymentStatuses([]);
            }
        } catch (error) {
            console.error('Failed to fetch payment statuses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch linked financing installment amounts for the selected month/year
    const fetchLinkedInstallments = async () => {
        try {
            const response = await fetch(`/api/financing-commitment-link?month=${selectedMonth}&year=${selectedYear}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setLinkedInstallments(data);
            } else {
                console.error('API returned non-array:', data);
                setLinkedInstallments([]);
            }
        } catch (error) {
            console.error('Failed to fetch linked installments:', error);
        }
    };

    // Load data on mount and when view changes
    useEffect(() => {
        if (commitmentsTypeView === 'current_commitments') {
            fetchCommitments('Active');
            fetchAllCommitments();
        } else if (commitmentsTypeView === 'future_commitments') {
            fetchCommitments('Pending');
            fetchAllCommitments();
        } else if (commitmentsTypeView === 'commitment_status') {
            fetchCommitments('Active');
            fetchPaymentStatuses();
            fetchLinkedInstallments();
        }
    }, [commitmentsTypeView]);

    // Reload payment status and linked installments when month/year changes
    useEffect(() => {
        if (commitmentsTypeView === 'commitment_status') {
            fetchPaymentStatuses();
            fetchLinkedInstallments();
        }
    }, [selectedMonth, selectedYear]);

    // Detect mobile for responsive column widths
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Get the linked installment for a specific commitment (if any)
    const getLinkedInstallment = (commitment_id: number): LinkedInstallment | undefined => {
        return linkedInstallments.find(li => li.commitment_id === commitment_id);
    };

    // Get effective monthly amount: use financing installment amount if linked, otherwise static
    const getEffectiveMonthlyAmount = (commitment: Commitment): number => {
        const linked = getLinkedInstallment(commitment.commitment_id);
        return linked ? linked.installment_amount : commitment.commitment_per_month;
    };

    // Calculate payment statistics
    const getPaidCount = () => {
        return paymentStatuses.filter(p => p.payment_status === 1).length;
    };

    const getUnpaidCount = () => {
        return commitments.length - getPaidCount();
    };

    const getTotalPaidAmount = () => {
        return commitments
            .filter(c => isCommitmentPaid(c.commitment_id))
            .reduce((sum, c) => sum + getEffectiveMonthlyAmount(c), 0);
    };

    const getTotalUnpaidAmount = () => {
        return commitments
            .filter(c => !isCommitmentPaid(c.commitment_id))
            .reduce((sum, c) => sum + getEffectiveMonthlyAmount(c), 0);
    };

    // Calculate total commitments amounts
    const getTotalActiveCommitments = () => {
        return allCommitments
            .filter(c => c.commitment_status === 'Active')
            .reduce((sum, c) => sum + c.commitment_per_month, 0);
    };

    const getTotalPendingCommitments = () => {
        return allCommitments
            .filter(c => c.commitment_status === 'Pending')
            .reduce((sum, c) => sum + c.commitment_per_month, 0);
    };

    const getTotalWithPending = () => {
        return getTotalActiveCommitments() + getTotalPendingCommitments();
    };

    const addCommitments = async() => {
        const result = await Swal.fire({
            title: 'Add New Commitment',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Commitment Name <span class='text-danger'>*</span></label>
                        <input id='commitment-name' type='text' class='form-control' placeholder='Enter commitment name'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Description</label>
                        <textarea id='commitment-description' class='form-control' placeholder='Enter commitment description'></textarea>
                    </div>
                    <div class=''>
                        <div class='row'>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <label class='form-label'>Monthly Total <span class='text-danger'>*</span></label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='commitment-monthly' type='text' class='form-control' placeholder='0.00'></input>
                                </div>
                            </div>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <label class='form-label'>Yearly Total (Auto)</label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='commitment-yearly' type='number' class='form-control' disabled></input>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Notes</label>
                        <textarea id='commitment-notes' class='form-control' placeholder='Enter notes'></textarea>
                    </div>
                </div>
            `,
            width: '700px',
            focusConfirm: false,
            confirmButtonText: "Submit",
            allowEscapeKey: false,
            allowOutsideClick: false,
            confirmButtonColor: "#28a745",
            showCancelButton: true,
            cancelButtonText: "Cancel",
            didOpen: () => {
                const monthlyInput = document.getElementById('commitment-monthly') as HTMLInputElement;
                const yearlyInput = document.getElementById('commitment-yearly') as HTMLInputElement;
                const getMonthlyValue = monthlyInput ? setupMoneyInput(monthlyInput) : () => 0;
                
                monthlyInput?.addEventListener('input', () => {
                    const monthly = getMonthlyValue();
                    yearlyInput.value = (monthly * 12).toFixed(2);
                });
            },
            preConfirm: () => {
                const name = (document.getElementById('commitment-name') as HTMLInputElement).value;
                const description = (document.getElementById('commitment-description') as HTMLTextAreaElement).value;
                const monthly = (document.getElementById('commitment-monthly') as HTMLInputElement).value;
                const notes = (document.getElementById('commitment-notes') as HTMLTextAreaElement).value;

                if (!name || !monthly) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    commitment_name: name,
                    commitment_description: description || null,
                    commitment_per_month: parseFloat(monthly),
                    commitment_per_year: parseFloat(monthly) * 12,
                    commitment_notes: notes || null,
                    commitment_status: 'Active'
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/commitments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Commitment added successfully', 'success');
                    fetchCommitments('Active');
                    fetchAllCommitments();
                } else {
                    Swal.fire('Error!', 'Failed to add commitment', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to add commitment', 'error');
            }
        }
    }

    const editCommitment = async(commitment: Commitment) => {
        const result = await Swal.fire({
            title: 'Edit Commitment',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Commitment Name <span class='text-danger'>*</span></label>
                        <input id='edit-commitment-name' type='text' class='form-control' value='${commitment.commitment_name}' placeholder='Enter commitment name'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Description</label>
                        <textarea id='edit-commitment-description' class='form-control' placeholder='Enter commitment description'>${commitment.commitment_description || ''}</textarea>
                    </div>
                    <div class=''>
                        <div class='row'>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <label class='form-label'>Monthly Total <span class='text-danger'>*</span></label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='edit-commitment-monthly' type='text' class='form-control' value='${commitment.commitment_per_month ? commitment.commitment_per_month.toFixed(2) : ''}'></input>
                                </div>
                            </div>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <label class='form-label'>Yearly Total (Auto)</label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='edit-commitment-yearly' type='number' class='form-control' value='${commitment.commitment_per_year}' disabled></input>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Notes</label>
                        <textarea id='edit-commitment-notes' class='form-control' placeholder='Enter notes'>${commitment.commitment_notes || ''}</textarea>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Status</label>
                        <select id='edit-commitment-status' class='form-select'>
                            <option value='Active' ${commitment.commitment_status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value='Pending' ${commitment.commitment_status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value='Inactive' ${commitment.commitment_status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                            <option value='On Hold' ${commitment.commitment_status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                        </select>
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
                const monthlyInput = document.getElementById('edit-commitment-monthly') as HTMLInputElement;
                const yearlyInput = document.getElementById('edit-commitment-yearly') as HTMLInputElement;
                const getMonthlyValue = monthlyInput ? setupMoneyInput(monthlyInput) : () => 0;
                
                monthlyInput?.addEventListener('input', () => {
                    const monthly = getMonthlyValue();
                    yearlyInput.value = (monthly * 12).toFixed(2);
                });
            },
            preConfirm: () => {
                const name = (document.getElementById('edit-commitment-name') as HTMLInputElement).value;
                const description = (document.getElementById('edit-commitment-description') as HTMLTextAreaElement).value;
                const monthly = (document.getElementById('edit-commitment-monthly') as HTMLInputElement).value;
                const notes = (document.getElementById('edit-commitment-notes') as HTMLTextAreaElement).value;
                const status = (document.getElementById('edit-commitment-status') as HTMLSelectElement).value;

                if (!name || !monthly) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    commitment_id: commitment.commitment_id,
                    commitment_name: name,
                    commitment_description: description || null,
                    commitment_per_month: parseFloat(monthly),
                    commitment_per_year: parseFloat(monthly) * 12,
                    commitment_notes: notes || null,
                    commitment_status: status,
                    commitment_start_month: commitment.commitment_start_month,
                    commitment_start_year: commitment.commitment_start_year
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/commitments', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Commitment updated successfully', 'success');
                    fetchCommitments(commitmentsTypeView === 'current_commitments' ? 'Active' : 'Pending');
                    fetchAllCommitments();
                } else {
                    Swal.fire('Error!', 'Failed to update commitment', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to update commitment', 'error');
            }
        }
    }

    const deleteCommitment = async(commitment_id: number, commitment_name: string) => {
        const result = await Swal.fire({
            title: 'Delete Commitment?',
            text: `Are you sure you want to delete "${commitment_name}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/commitments?id=${commitment_id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    Swal.fire('Deleted!', 'Commitment has been deleted.', 'success');
                    fetchCommitments(commitmentsTypeView === 'current_commitments' ? 'Active' : 'Pending');
                    fetchAllCommitments();
                } else {
                    Swal.fire('Error!', 'Failed to delete commitment', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete commitment', 'error');
            }
        }
    }

    const addFutureCommitments = async() => {
        const result = await Swal.fire({
            title: 'Add New Future Commitment',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Commitment Name <span class='text-danger'>*</span></label>
                        <input id='future-commitment-name' type='text' class='form-control' placeholder='Enter commitment name'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Description</label>
                        <textarea id='future-commitment-description' class='form-control' placeholder='Enter commitment description'></textarea>
                    </div>
                    <div class=''>
                        <div class='row'>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <label class='form-label'>Monthly Total <span class='text-danger'>*</span></label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='future-commitment-monthly' type='text' class='form-control' placeholder='0.00'></input>
                                </div>
                            </div>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <label class='form-label'>Yearly Total (Auto)</label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='future-commitment-yearly' type='number' class='form-control' disabled></input>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Start Date (Optional)</label>
                        <div class='row'>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <select id='future-commitment-month' class='form-select'>
                                    <option value=''>-- Select Month --</option>
                                    ${monthNames.map((m, i) => `<option value='${i}'>${m}</option>`).join('')}
                                </select>
                            </div>
                            <div class='col-6 cancel-col mb-4 cancel-px'>
                                <select id='future-commitment-year' class='form-select'>
                                    <option value=''>-- Select Year --</option>
                                    ${yearOptions.map(y => `<option value='${y}'>${y}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Notes</label>
                        <textarea id='future-commitment-notes' class='form-control' placeholder='Enter notes'></textarea>
                    </div>
                </div>
            `,
            width: '700px',
            focusConfirm: false,
            confirmButtonText: "Submit",
            allowEscapeKey: false,
            allowOutsideClick: false,
            confirmButtonColor: "#28a745",
            showCancelButton: true,
            cancelButtonText: "Cancel",
            didOpen: () => {
                const monthlyInput = document.getElementById('future-commitment-monthly') as HTMLInputElement;
                const yearlyInput = document.getElementById('future-commitment-yearly') as HTMLInputElement;
                const getMonthlyValue = monthlyInput ? setupMoneyInput(monthlyInput) : () => 0;
                
                monthlyInput?.addEventListener('input', () => {
                    const monthly = getMonthlyValue();
                    yearlyInput.value = (monthly * 12).toFixed(2);
                });
            },
            preConfirm: () => {
                const name = (document.getElementById('future-commitment-name') as HTMLInputElement).value;
                const description = (document.getElementById('future-commitment-description') as HTMLTextAreaElement).value;
                const monthly = (document.getElementById('future-commitment-monthly') as HTMLInputElement).value;
                const notes = (document.getElementById('future-commitment-notes') as HTMLTextAreaElement).value;
                const startMonth = (document.getElementById('future-commitment-month') as HTMLSelectElement).value;
                const startYear = (document.getElementById('future-commitment-year') as HTMLSelectElement).value;

                if (!name || !monthly) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    commitment_name: name,
                    commitment_description: description || null,
                    commitment_per_month: parseFloat(monthly),
                    commitment_per_year: parseFloat(monthly) * 12,
                    commitment_notes: notes || null,
                    commitment_status: 'Pending',
                    commitment_start_month: startMonth ? parseInt(startMonth) : null,
                    commitment_start_year: startYear ? parseInt(startYear) : null
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/commitments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Future commitment added successfully', 'success');
                    fetchCommitments('Pending');
                    fetchAllCommitments();
                } else {
                    Swal.fire('Error!', 'Failed to add future commitment', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to add future commitment', 'error');
            }
        }
    }

    // Toggle payment status with loading and toast notification
    // Also syncs with financing installments if the commitment is linked
    const togglePaymentStatus = async (commitment_id: number, commitment_name: string, checked: boolean) => {
        setCheckboxLoading(commitment_id);

        try {
            // Simulate minimum 0.5 second loading
            await new Promise(resolve => setTimeout(resolve, 500));

            const response = await fetch('/api/commitment-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commitment_id,
                    payment_month: selectedMonth,
                    payment_year: selectedYear,
                    payment_status: checked
                })
            });

            if (response.ok) {
                // Bi-directional sync: also update linked financing installment
                const linked = getLinkedInstallment(commitment_id);
                if (linked) {
                    try {
                        await fetch('/api/financing-installments', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                installment_id: linked.installment_id,
                                payment_status: checked ? 'paid' : 'pending',
                                amount_paid: checked ? linked.installment_amount : 0,
                                paid_date: checked ? new Date().toISOString().split('T')[0] : null
                            })
                        });
                    } catch (syncError) {
                        console.error('Failed to sync financing installment:', syncError);
                    }
                }

                await fetchPaymentStatuses();
                await fetchLinkedInstallments();

                // Show toast notification
                Toast.fire({
                    icon: checked ? 'success' : 'info',
                    title: checked
                        ? `${commitment_name} marked as Paid`
                        : `${commitment_name} marked as Not Paid`
                });
            } else {
                Swal.fire('Error!', 'Failed to update payment status', 'error');
            }
        } catch (error) {
            Swal.fire('Error!', 'Failed to update payment status', 'error');
        } finally {
            setCheckboxLoading(null);
        }
    };

    // Check if commitment is paid for current selected month/year
    const isCommitmentPaid = (commitment_id: number): boolean => {
        const payment = paymentStatuses.find(
            p => p.commitment_id === commitment_id
        );
        return payment ? payment.payment_status === 1 : false;
    };

    // Simplified columns for Inactive/On Hold tables
    const simplifiedColumns: TableColumnsType<Commitment> = [
        {
            title: 'Name',
            dataIndex: 'commitment_name',
            key: 'commitment_name',
        },
        {
            title: 'MYR / month',
            dataIndex: 'commitment_per_month',
            key: 'commitment_per_month',
            render: (value) => `MYR ${value.toFixed(2)}`
        },
        {
            title: 'MYR / year',
            dataIndex: 'commitment_per_year',
            key: 'commitment_per_year',
            render: (value) => `MYR ${value.toFixed(2)}`
        },
        {
            title: 'Status',
            dataIndex: 'commitment_status',
            key: 'commitment_status',
            render: (status) => {
                const color = status === 'On Hold' ? 'info' : 'secondary';
                return <span className={`badge bg-${color}`}>{status}</span>;
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <div className='d-flex gap-2'>
                    <Tooltip title="Edit">
                        <button
                            className='btn btn-sm btn-primary'
                            onClick={() => editCommitment(record)}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <button
                            className='btn btn-sm btn-danger'
                            onClick={() => deleteCommitment(record.commitment_id, record.commitment_name)}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    // Columns for current/future commitments table
    const commitmentColumns: TableColumnsType<Commitment> = [
        {
            title: 'Name',
            dataIndex: 'commitment_name',
            key: 'commitment_name',
            width: isMobile ? 200 : undefined,
        },
        {
            title: 'Description',
            dataIndex: 'commitment_description',
            key: 'commitment_description',
            width: isMobile ? 200 : undefined,
            render: (text) => text || '-'
        },
        {
            title: 'MYR / month',
            dataIndex: 'commitment_per_month',
            key: 'commitment_per_month',
            render: (value) => `MYR ${value.toFixed(2)}`
        },
        {
            title: 'MYR / year',
            dataIndex: 'commitment_per_year',
            key: 'commitment_per_year',
            render: (value) => `MYR ${value.toFixed(2)}`
        },
        {
            title: 'Notes',
            dataIndex: 'commitment_notes',
            key: 'commitment_notes',
            width: isMobile ? 200 : undefined,
            render: (text) => text || '-'
        },
        {
            title: 'Status',
            dataIndex: 'commitment_status',
            key: 'commitment_status',
            render: (status) => {
                const color = status === 'Active' ? 'success' : status === 'Pending' ? 'warning' : status === 'On Hold' ? 'info' : 'secondary';
                return <span className={`badge bg-${color}`}>{status}</span>;
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <div className='d-flex gap-2'>
                    <Tooltip title="Edit">
                        <button
                            className='btn btn-sm btn-primary'
                            onClick={() => editCommitment(record)}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <button
                            className='btn btn-sm btn-danger'
                            onClick={() => deleteCommitment(record.commitment_id, record.commitment_name)}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    // Columns for payment status table
    const paymentStatusColumns: TableColumnsType<Commitment> = [
        {
            title: 'Commitment Name',
            key: 'commitment_name',
            render: (_, record) => {
                const linked = getLinkedInstallment(record.commitment_id);
                return (
                    <div>
                        <div className='d-flex align-items-center gap-2'>
                            <span>{record.commitment_name}</span>
                            {linked && (
                                <Tag color='blue' style={{ fontSize: '10px', lineHeight: '16px', padding: '0 4px', margin: 0 }}>📊 Financing</Tag>
                            )}
                        </div>
                        {linked && (
                            <small className='text-muted'>Due: {new Date(linked.installment_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</small>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Monthly Amount',
            key: 'commitment_per_month',
            render: (_, record) => {
                const linked = getLinkedInstallment(record.commitment_id);
                const effectiveAmount = getEffectiveMonthlyAmount(record);
                return (
                    <div>
                        <span>MYR {effectiveAmount.toFixed(2)}</span>
                        {linked && linked.installment_amount !== record.commitment_per_month && (
                            <small className='d-block text-muted' style={{ textDecoration: 'line-through', fontSize: '11px' }}>
                                Default: MYR {record.commitment_per_month.toFixed(2)}
                            </small>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'commitment_status',
            key: 'commitment_status',
            render: (status) => {
                const color = status === 'Active' ? 'success' : 'warning';
                return <span className={`badge bg-${color}`}>{status}</span>;
            }
        },
        {
            title: 'Payment Status',
            key: 'payment_status',
            render: (_, record) => (
                <Spin spinning={checkboxLoading === record.commitment_id} size="small">
                    <Checkbox
                        checked={isCommitmentPaid(record.commitment_id)}
                        disabled={checkboxLoading === record.commitment_id}
                        onChange={(e) => togglePaymentStatus(record.commitment_id, record.commitment_name, e.target.checked)}
                    >
                        {isCommitmentPaid(record.commitment_id) ? 'Paid' : 'Not Paid'}
                    </Checkbox>
                </Spin>
            )
        }
    ];

    return (
        <div>
            <div className="d-flex align-items-center justify-content-between mb-3 commitment-header-wrapper">
                <div className='d-flex align-items-center title-pages'>
                    <i className='bi bi-cash-stack fs-3 text-secondary me-2 bi-title'></i>
                    <h3 className='text-secondary p-0 m-0'><strong>Commitments</strong></h3>
                </div>

                <div className="btn-group commitment-button-group" role="group">
                    <button type="button" className={`btn ${commitmentsTypeView === 'commitment_status' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setCommitmentTypeView('commitment_status')}>
                        Commitment Status
                    </button>
                    <button type="button" className={`btn ${commitmentsTypeView === 'current_commitments' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setCommitmentTypeView('current_commitments')}>
                        Current Commitments
                    </button>
                    <button type="button" className={`btn ${commitmentsTypeView === 'future_commitments' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => setCommitmentTypeView('future_commitments')}>
                        Future Commitments
                    </button>
                </div>
            </div>

            <div className='border-bottom mb-3'></div>

            {commitmentsTypeView === 'commitment_status' && (
                <div>
                    {/* Summary Cards */}
                    <div className='row mb-3'>
                        <div className='col-6 cancel-left-pad-mar'>
                            <div className='card bg-success text-white'>
                                <div className='card-body'>
                                    <div className='d-flex justify-content-between align-items-center'>
                                        <div>
                                            <h6 className='mb-1'>Total Paid</h6>
                                            <h3 className='mb-0'>{getPaidCount()} Commitments</h3>
                                            <small>MYR {getTotalPaidAmount().toFixed(2)}</small>
                                        </div>
                                        <i className="bi bi-check-circle" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='col-6 cancel-right-pad-mar'>
                            <div className='card bg-warning text-white'>
                                <div className='card-body'>
                                    <div className='d-flex justify-content-between align-items-center'>
                                        <div>
                                            <h6 className='mb-1'>Total Unpaid</h6>
                                            <h3 className='mb-0'>{getUnpaidCount()} Commitments</h3>
                                            <small>MYR {getTotalUnpaidAmount().toFixed(2)}</small>
                                        </div>
                                        <i className="bi bi-exclamation-circle" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between p-3 cancel-dflex">
                            <div className="d-flex align-items-center commitment-padding-bottom">
                                <i className="bi bi-card-checklist text-secondary fw-bold me-2"></i>
                                <h5 className="fw-bold text-secondary m-0 p-0">Commitment Status</h5>
                            </div>

                             <div className='d-flex align-items-center gap-2'>
                                <select className='form-select form-select-sm cancel-from-width' value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ width: '130px' }}>
                                    {monthNames.map((m, index) => (
                                        <option key={m} value={index}>{m}</option>
                                    ))}
                                </select>
                                <select className='form-select form-select-sm cancel-from-width' value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: '100px' }}>
                                    {yearOptions.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className='card-body p-3'>
                            <Table
                                dataSource={commitments}
                                columns={paymentStatusColumns}
                                loading={isLoading}
                                rowKey="commitment_id"
                                pagination={false}
                                scroll={{ x: isMobile ? 'max-content' : undefined }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {commitmentsTypeView === 'current_commitments' && (
                <div>
                    {/* Total Commitment Card */}
                    <div className='card bg-primary text-white mb-3'>
                        <div className='card-body'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <h6 className='mb-1'>Total Active Commitments</h6>
                                    <h3 className='mb-0'>MYR {getTotalActiveCommitments().toFixed(2)}/month</h3>
                                    <small>MYR {(getTotalActiveCommitments() * 12).toFixed(2)}/year</small>
                                </div>
                                <i className="bi bi-receipt" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-3">
                        <div className="card-header d-flex align-items-center justify-content-between p-3">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-receipt-cutoff text-secondary me-2"></i>
                                <h5 className="fw-bold text-secondary m-0 p-0">Current Commitments</h5>
                            </div>

                            <button className="btn btn-outline-secondary d-flex align-items-center" onClick={() => addCommitments()}>
                                <i className="bi bi-plus-circle me-2"></i>
                                <span>Add Commitment</span>
                            </button>
                        </div>

                        <div className='card-body p-3'>
                            <Table
                                dataSource={commitments}
                                columns={commitmentColumns}
                                loading={isLoading}
                                rowKey="commitment_id"
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: isMobile ? 'max-content' : undefined }}
                            />
                        </div>
                    </div>

                    {/* Inactive and On Hold Cards */}
                    <div className='row'>
                        <div className='col-6 cancel-col px-0 pe-2 commitment-no-pad-mar-x'>
                            <div className='card p-3 px-4 pb-4'>
                                <div className='d-flex align-items-center pb-3'>
                                    <i className="bi bi-archive me-2 text-secondary"></i>
                                    <h6 className="fw-bold text-secondary m-0 p-0">Inactive Commitments</h6>
                                </div>
                                <Table
                                    dataSource={allCommitments.filter(c => c.commitment_status === 'Inactive')}
                                    columns={simplifiedColumns}
                                    rowKey="commitment_id"
                                    pagination={false}
                                    size="small"
                                    scroll={{ x: isMobile ? 'max-content' : undefined }}
                                />
                            </div>
                        </div>
                        <div className='col-6 cancel-col px-0 ps-2 commitment-no-pad-mar-x'>
                            <div className='card p-3 px-4 pb-4'>
                                <div className='d-flex align-items-center pb-3'>
                                    <i className="bi bi-pause-circle me-2 text-info"></i>
                                    <h6 className="fw-bold text-info m-0 p-0">On Hold Commitments</h6>
                                </div>
                                <Table
                                    dataSource={allCommitments.filter(c => c.commitment_status === 'On Hold')}
                                    columns={simplifiedColumns}
                                    rowKey="commitment_id"
                                    pagination={false}
                                    size="small"
                                    scroll={{ x: isMobile ? 'max-content' : undefined }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {commitmentsTypeView === 'future_commitments' && (
                <div>
                    {/* Summary Cards */}
                    <div className='row mb-3'>
                        <div className='col-4 cancel-col'>
                            <div className='card bg-success text-white'>
                                <div className='card-body'>
                                    <h6 className='mb-1'>Current Commitments</h6>
                                    <h4 className='mb-0'>MYR {getTotalActiveCommitments().toFixed(2)}/month</h4>
                                </div>
                            </div>
                        </div>
                        <div className='col-4 cancel-col'>
                            <div className='card bg-warning text-white'>
                                <div className='card-body'>
                                    <h6 className='mb-1'>Pending Commitments</h6>
                                    <h4 className='mb-0'>MYR {getTotalPendingCommitments().toFixed(2)}/month</h4>
                                </div>
                            </div>
                        </div>
                        <div className='col-4 cancel-col'>
                            <div className='card bg-danger text-white'>
                                <div className='card-body'>
                                    <h6 className='mb-1'>Total After Pending</h6>
                                    <h4 className='mb-0'>MYR {getTotalWithPending().toFixed(2)}/month</h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-3">
                        <div className="card-header d-flex align-items-center justify-content-between p-3">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-bookmark-plus text-secondary me-2"></i>
                                <h5 className="fw-bold text-secondary m-0 p-0">Future Commitments</h5>
                            </div>

                             <button className="btn btn-outline-secondary d-flex align-items-center" onClick={() => addFutureCommitments()}>
                                <i className="bi bi-plus-circle me-2"></i>
                                <span>Add Future Commitment</span>
                            </button>
                        </div>

                        <div className='card-body p-3'>
                            <Table
                                dataSource={commitments}
                                columns={commitmentColumns}
                                loading={isLoading}
                                rowKey="commitment_id"
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: isMobile ? 'max-content' : undefined }}
                            />
                        </div>
                    </div>

                    {/* Inactive and On Hold Cards */}
                    <div className='row'>
                        <div className='col-6 cancel-col commitment-no-pad-mar-x'>
                            <div className='card p-3 px-4 pb-4'>
                                <div className='d-flex align-items-center pb-3'>
                                    <i className="bi bi-archive me-2 text-secondary"></i>
                                    <h6 className="fw-bold text-secondary m-0 p-0">Inactive Commitments</h6>
                                </div>
                                <Table
                                    dataSource={allCommitments.filter(c => c.commitment_status === 'Inactive')}
                                    columns={simplifiedColumns}
                                    rowKey="commitment_id"
                                    pagination={false}
                                    size="small"
                                    scroll={{ x: isMobile ? 'max-content' : undefined }}
                                />
                            </div>
                        </div>
                        <div className='col-6 cancel-col commitment-no-pad-mar-x'>
                            <div className='card p-3 px-4 pb-4'>
                                <div className='d-flex align-items-center pb-3'>
                                    <i className="bi bi-pause-circle me-2 text-info"></i>
                                    <h6 className="fw-bold text-info m-0 p-0">On Hold Commitments</h6>
                                </div>
                                <Table
                                    dataSource={allCommitments.filter(c => c.commitment_status === 'On Hold')}
                                    columns={simplifiedColumns}
                                    rowKey="commitment_id"
                                    pagination={false}
                                    size="small"
                                    scroll={{ x: isMobile ? 'max-content' : undefined }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )

}
