"use client"

import React from 'react'
import Swal from 'sweetalert2';
import { useState, useEffect } from "react"
import { Table, Tooltip, Select, Progress, Checkbox, Spin, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { setupMoneyInput, setupWholeNumberInput } from '@/lib/input-helpers';

interface FinancingPlan {
    financing_id: number;
    financing_name: string;
    financing_provider: string | null;
    financing_category: string;
    total_amount: number;
    total_months: number;
    monthly_amount_default: number;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    status: string;
    linked_commitment_id: number | null;
    created_at: string;
}

interface Installment {
    installment_id: number;
    financing_id: number;
    installment_number: number;
    due_date: string;
    amount_due: number;
    amount_paid: number;
    payment_status: string;
    paid_date: string | null;
    notes: string | null;
    financing_name?: string;
    financing_provider?: string;
    financing_category?: string;
    plan_status?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    'bnpl': 'Buy Now Pay Later',
    'car_loan': 'Car Loan',
    'home_loan': 'Home Loan',
    'personal_loan': 'Personal Loan',
    'credit_card': 'Credit Card',
    'education_loan': 'Education Loan',
    'other': 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
    'bnpl': '#722ed1',
    'car_loan': '#1890ff',
    'home_loan': '#13c2c2',
    'personal_loan': '#fa8c16',
    'credit_card': '#f5222d',
    'education_loan': '#52c41a',
    'other': '#8c8c8c',
};

export default function FinancingPage() {
    const [plans, setPlans] = useState<FinancingPlan[]>([]);
    const [upcomingInstallments, setUpcomingInstallments] = useState<Installment[]>([]);
    const [expandedInstallments, setExpandedInstallments] = useState<Record<number, Installment[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [checkboxLoading, setCheckboxLoading] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('active');

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
    });

    // ========== Data Fetching ==========

    const fetchPlans = async () => {
        try {
            setIsLoading(true);
            const url = statusFilter === 'all' ? '/api/financing' : `/api/financing?status=${statusFilter}`;
            const response = await fetch(url);
            const data = await response.json();
            if (Array.isArray(data)) {
                setPlans(data);
                // Pre-fetch installments for all plans so Monthly & Progress columns work immediately
                fetchAllInstallments(data);
            } else {
                console.error('API returned non-array:', data);
                setPlans([]);
            }
        } catch (error) {
            console.error('Failed to fetch financing plans:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUpcoming = async () => {
        try {
            const response = await fetch(`/api/financing-installments?month=${currentMonth}&year=${currentYear}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setUpcomingInstallments(data);
            } else {
                console.error('API returned non-array:', data);
                setUpcomingInstallments([]);
            }
        } catch (error) {
            console.error('Failed to fetch upcoming installments:', error);
        }
    };

    const fetchInstallments = async (financingId: number) => {
        try {
            const response = await fetch(`/api/financing-installments?financing_id=${financingId}`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setExpandedInstallments(prev => ({ ...prev, [financingId]: data }));
            } else {
                console.error('API returned non-array:', data);
                setExpandedInstallments(prev => ({ ...prev, [financingId]: [] }));
            }
        } catch (error) {
            console.error('Failed to fetch installments:', error);
        }
    };

    // Pre-fetch installments for all plans (runs on initial load)
    const fetchAllInstallments = async (planList: FinancingPlan[]) => {
        try {
            const results = await Promise.all(
                planList.map(async (plan) => {
                    const response = await fetch(`/api/financing-installments?financing_id=${plan.financing_id}`);
                    const data = await response.json();
                    return { id: plan.financing_id, installments: data };
                })
            );
            const allInstallments: Record<number, Installment[]> = {};
            results.forEach(r => { allInstallments[r.id] = r.installments; });
            setExpandedInstallments(allInstallments);
        } catch (error) {
            console.error('Failed to pre-fetch installments:', error);
        }
    };

    useEffect(() => {
        fetchPlans();
        fetchUpcoming();
    }, [statusFilter]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ========== Helpers ==========

    const activePlans = plans.filter(p => p.status === 'active');

    const getPlanProgress = (plan: FinancingPlan) => {
        const installments = expandedInstallments[plan.financing_id] || [];
        if (installments.length === 0) return { paid: 0, total: plan.total_months, percent: 0 };
        const paidCount = installments.filter(i => i.payment_status === 'paid').length;
        return {
            paid: paidCount,
            total: plan.total_months,
            percent: Math.round((paidCount / plan.total_months) * 100)
        };
    };

    // Check if a plan has varying installment amounts
    const hasVaryingAmounts = (plan: FinancingPlan) => {
        const installments = expandedInstallments[plan.financing_id] || [];
        if (installments.length <= 1) return false;
        const firstAmount = installments[0]?.amount_due;
        return installments.some(i => Math.abs(i.amount_due - firstAmount) > 0.01);
    };

    // Get min and max installment amounts for a plan
    const getAmountRange = (plan: FinancingPlan) => {
        const installments = expandedInstallments[plan.financing_id] || [];
        if (installments.length === 0) return { min: plan.monthly_amount_default, max: plan.monthly_amount_default };
        const amounts = installments.map(i => i.amount_due);
        return { min: Math.min(...amounts), max: Math.max(...amounts) };
    };

    const calculateEndDate = (startDate: string, months: number): string => {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + months - 1);
        return date.toISOString().split('T')[0];
    };

    const generateInstallmentDates = (startDate: string, months: number): string[] => {
        const dates: string[] = [];
        const start = new Date(startDate);
        for (let i = 0; i < months; i++) {
            const date = new Date(start);
            date.setMonth(date.getMonth() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    };

    // ========== Toggle Installment Paid ==========

    const toggleInstallmentPaid = async (installment: Installment, checked: boolean) => {
        setCheckboxLoading(installment.installment_id);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const response = await fetch('/api/financing-installments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    installment_id: installment.installment_id,
                    payment_status: checked ? 'paid' : 'pending',
                    amount_paid: checked ? installment.amount_due : 0,
                    paid_date: checked ? new Date().toISOString().split('T')[0] : null
                })
            });
            if (response.ok) {
                // Bi-directional sync: also update linked commitment payment status
                const plan = plans.find(p => p.financing_id === installment.financing_id);
                if (plan?.linked_commitment_id) {
                    try {
                        const dueDate = new Date(installment.due_date);
                        await fetch('/api/commitment-payments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                commitment_id: plan.linked_commitment_id,
                                payment_month: dueDate.getMonth(),
                                payment_year: dueDate.getFullYear(),
                                payment_status: checked
                            })
                        });
                    } catch (syncError) {
                        console.error('Failed to sync commitment payment:', syncError);
                    }
                }

                await fetchInstallments(installment.financing_id);
                await fetchUpcoming();
                Toast.fire({ icon: checked ? 'success' : 'info', title: checked ? 'Marked as Paid' : 'Marked as Unpaid' });
            }
        } catch (error) {
            Swal.fire('Error!', 'Failed to update payment status', 'error');
        } finally {
            setCheckboxLoading(null);
        }
    };

    // ========== Edit Individual Installment Amount ==========

    const editInstallmentAmount = async (installment: Installment) => {
        const result = await Swal.fire({
            title: 'Edit Installment',
            html: `
                <div class='text-start'>
                    <p class='text-muted mb-3'><small>Installment #${installment.installment_number} — Due: ${new Date(installment.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small></p>
                    <div class='mb-3'>
                        <label class='form-label'>Amount Due (MYR)</label>
                        <div class='input-group'>
                            <span class='input-group-text'>MYR</span>
                            <input id='edit-inst-amount' type='number' class='form-control' value='${installment.amount_due.toFixed(2)}'>
                        </div>
                    </div>
                    <div class='mb-3'>
                        <label class='form-label'>Due Date</label>
                        <input id='edit-inst-date' type='date' class='form-control' value='${installment.due_date}'>
                    </div>
                </div>
            `,
            confirmButtonText: 'Update',
            confirmButtonColor: '#1890ff',
            showCancelButton: true,
            reverseButtons: true,
            didOpen: () => {
                const amountInput = document.getElementById('edit-inst-amount') as HTMLInputElement;
                if (amountInput) setupMoneyInput(amountInput);
            },
            preConfirm: () => {
                const amount = parseFloat((document.getElementById('edit-inst-amount') as HTMLInputElement).value);
                const dueDate = (document.getElementById('edit-inst-date') as HTMLInputElement).value;
                if (!amount || amount <= 0) { Swal.showValidationMessage('Amount must be greater than 0'); return false; }
                return { amount, dueDate };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/financing-installments', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        installment_id: installment.installment_id,
                        amount_due: result.value.amount,
                        due_date: result.value.dueDate
                    })
                });
                if (response.ok) {
                    await fetchInstallments(installment.financing_id);
                    await fetchUpcoming();
                    Toast.fire({ icon: 'success', title: 'Installment updated' });
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to update installment', 'error');
            }
        }
    };

    // ========== Add Financing Wizard ==========

    const addFinancing = async () => {
        // Persistent state across all steps
        let basicInfo: any = { name: '', provider: '', category: '', total: 0, notes: '' };
        let scheduleInfo: any = { months: '', monthly: '', startDate: new Date().toISOString().split('T')[0], sameAmount: true, sameDueDate: true, linkCommitment: true };
        let customInstallments: { amount: number; dueDate: string }[] = [];
        let currentStep = 1;

        while (true) {
            // =============== STEP 1: Basic Info ===============
            if (currentStep === 1) {
                const step1 = await Swal.fire({
                    title: 'Add Financing — Step 1 of 3',
                    html: `
                        <div class='text-start'>
                            <p class='text-muted mb-3'><small>Basic information about the financing</small></p>
                            <div class='mb-4'>
                                <label class='form-label'>Financing Name <span class='text-danger'>*</span></label>
                                <input id='fin-name' type='text' class='form-control' placeholder='e.g. SPay Later - iPhone 16' value='${basicInfo.name}'>
                            </div>
                            <div class='mb-4'>
                                <label class='form-label'>Provider</label>
                                <input id='fin-provider' type='text' class='form-control' placeholder='e.g. SFinancing, Maybank, Atome' value='${basicInfo.provider}'>
                            </div>
                            <div class='mb-4'>
                                <label class='form-label'>Category <span class='text-danger'>*</span></label>
                                <select id='fin-category' class='form-select'>
                                    <option value=''>Select category</option>
                                    <option value='bnpl' ${basicInfo.category === 'bnpl' ? 'selected' : ''}>Buy Now Pay Later (BNPL)</option>
                                    <option value='car_loan' ${basicInfo.category === 'car_loan' ? 'selected' : ''}>Car Loan</option>
                                    <option value='home_loan' ${basicInfo.category === 'home_loan' ? 'selected' : ''}>Home Loan</option>
                                    <option value='personal_loan' ${basicInfo.category === 'personal_loan' ? 'selected' : ''}>Personal Loan</option>
                                    <option value='credit_card' ${basicInfo.category === 'credit_card' ? 'selected' : ''}>Credit Card Installment</option>
                                    <option value='education_loan' ${basicInfo.category === 'education_loan' ? 'selected' : ''}>Education Loan</option>
                                    <option value='other' ${basicInfo.category === 'other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                            <div class='mb-4'>
                                <label class='form-label'>Total Amount (MYR) <span class='text-danger'>*</span></label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='fin-total' type='number' class='form-control' placeholder='0.00' value='${basicInfo.total > 0 ? basicInfo.total.toFixed(2) : ''}'>
                                </div>
                            </div>
                            <div class='mb-4'>
                                <label class='form-label'>Notes</label>
                                <textarea id='fin-notes' class='form-control' rows='2' placeholder='Optional notes...'>${basicInfo.notes}</textarea>
                            </div>
                        </div>
                    `,
                    width: '700px',
                    confirmButtonText: 'Next →',
                    confirmButtonColor: '#1890ff',
                    showCancelButton: true,
                    cancelButtonText: 'Cancel',
                    allowEscapeKey: false,
                    allowOutsideClick: false,
                    reverseButtons: true,
                    didOpen: () => {
                        const totalInput = document.getElementById('fin-total') as HTMLInputElement;
                        if (totalInput) setupMoneyInput(totalInput);

                        const checkFields = () => {
                            const name = (document.getElementById('fin-name') as HTMLInputElement)?.value?.trim();
                            const category = (document.getElementById('fin-category') as HTMLSelectElement)?.value;
                            const total = (document.getElementById('fin-total') as HTMLInputElement)?.value;
                            const confirmBtn = Swal.getConfirmButton();
                            if (confirmBtn) confirmBtn.disabled = !name || !category || !total || parseFloat(total) <= 0;
                        };

                        ['fin-name', 'fin-category', 'fin-total'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) { el.addEventListener('input', checkFields); el.addEventListener('change', checkFields); }
                        });

                        // Run check immediately for pre-filled values
                        setTimeout(checkFields, 50);
                    },
                    preConfirm: () => {
                        return {
                            name: (document.getElementById('fin-name') as HTMLInputElement).value.trim(),
                            provider: (document.getElementById('fin-provider') as HTMLInputElement).value.trim(),
                            category: (document.getElementById('fin-category') as HTMLSelectElement).value,
                            total: parseFloat((document.getElementById('fin-total') as HTMLInputElement).value),
                            notes: (document.getElementById('fin-notes') as HTMLTextAreaElement).value
                        };
                    }
                });

                if (!step1.isConfirmed || !step1.value) return; // Cancel
                basicInfo = step1.value;
                currentStep = 2;
                continue;
            }

            // =============== STEP 2: Payment Schedule ===============
            if (currentStep === 2) {
                const step2 = await Swal.fire({
                    title: 'Add Financing — Step 2 of 3',
                    html: `
                        <div class='text-start'>
                            <p class='text-muted mb-3'><small>Define the payment schedule for <strong>${basicInfo.name}</strong></small></p>
                            <div class='mb-4'>
                                <label class='form-label'>Total Months <span class='text-danger'>*</span></label>
                                <input id='fin-months' type='number' min='1' class='form-control' placeholder='e.g. 6, 12, 84' value='${scheduleInfo.months}'>
                            </div>
                            <div class='mb-3'>
                                <div class='form-check'>
                                    <input class='form-check-input' type='checkbox' id='fin-same-amount'${scheduleInfo.sameAmount ? ' checked' : ''}>
                                    <label class='form-check-label' for='fin-same-amount'>
                                        <strong>Same amount for all months</strong>
                                    </label>
                                </div>
                                <small class='text-muted'>Uncheck if monthly amounts vary (e.g. higher first payment)</small>
                            </div>
                            <div id='monthly-field' class='mb-4' style='display:${scheduleInfo.sameAmount ? 'block' : 'none'}'>
                                <label class='form-label'>Default Monthly (MYR) <span class='text-danger'>*</span></label>
                                <div class='input-group'>
                                    <span class='input-group-text'>MYR</span>
                                    <input id='fin-monthly' type='number' class='form-control' placeholder='0.00' value='${scheduleInfo.monthly && parseFloat(scheduleInfo.monthly) > 0 ? parseFloat(scheduleInfo.monthly).toFixed(2) : ''}'>
                                </div>
                            </div>
                            <div class='mb-3'>
                                <div class='form-check'>
                                    <input class='form-check-input' type='checkbox' id='fin-same-duedate'${scheduleInfo.sameDueDate ? ' checked' : ''}>
                                    <label class='form-check-label' for='fin-same-duedate'>
                                        <strong>Same due date every month</strong>
                                    </label>
                                </div>
                                <small class='text-muted'>Uncheck if due dates are irregular or vary each month</small>
                            </div>
                            <div id='duedate-field' class='mb-4' style='display:${scheduleInfo.sameDueDate ? 'block' : 'none'}'>
                                <label class='form-label'>First Payment Due Date <span class='text-danger'>*</span></label>
                                <input id='fin-start' type='date' class='form-control' value='${scheduleInfo.startDate}'>
                            </div>
                            <div class='mb-4'>
                                <div class='form-check'>
                                    <input class='form-check-input' type='checkbox' id='fin-link-commitment'${scheduleInfo.linkCommitment ? ' checked' : ''}>
                                    <label class='form-check-label' for='fin-link-commitment'>
                                        <strong>Also add as a monthly commitment</strong>
                                    </label>
                                </div>
                                <small class='text-muted'>Shows this in the Commitment Status page for monthly tracking</small>
                            </div>
                        </div>
                    `,
                    width: '700px',
                    confirmButtonText: 'Next →',
                    confirmButtonColor: '#1890ff',
                    showDenyButton: true,
                    denyButtonText: '← Back',
                    denyButtonColor: '#6c757d',
                    showCancelButton: true,
                    cancelButtonText: 'Cancel',
                    allowEscapeKey: false,
                    allowOutsideClick: false,
                    customClass: { actions: 'swal-wizard-actions' },
                    didOpen: () => {
                        const monthsInput = document.getElementById('fin-months') as HTMLInputElement;
                        const monthlyInput = document.getElementById('fin-monthly') as HTMLInputElement;
                        const sameAmountCheck = document.getElementById('fin-same-amount') as HTMLInputElement;
                        const sameDueDateCheck = document.getElementById('fin-same-duedate') as HTMLInputElement;
                        const monthlyField = document.getElementById('monthly-field') as HTMLElement;
                        const dueDateField = document.getElementById('duedate-field') as HTMLElement;

                        if (monthsInput) setupWholeNumberInput(monthsInput);
                        if (monthlyInput) setupMoneyInput(monthlyInput);

                        // Toggle field visibility based on checkboxes
                        sameAmountCheck?.addEventListener('change', () => {
                            monthlyField.style.display = sameAmountCheck.checked ? 'block' : 'none';
                            checkFields();
                        });
                        sameDueDateCheck?.addEventListener('change', () => {
                            dueDateField.style.display = sameDueDateCheck.checked ? 'block' : 'none';
                            checkFields();
                        });

                        const checkFields = () => {
                            const months = (document.getElementById('fin-months') as HTMLInputElement)?.value;
                            const sameAmount = (document.getElementById('fin-same-amount') as HTMLInputElement)?.checked;
                            const sameDueDate = (document.getElementById('fin-same-duedate') as HTMLInputElement)?.checked;
                            const monthly = (document.getElementById('fin-monthly') as HTMLInputElement)?.value;
                            const startDate = (document.getElementById('fin-start') as HTMLInputElement)?.value;
                            const confirmBtn = Swal.getConfirmButton();

                            let valid = !!months && parseInt(months) > 0;
                            if (sameAmount && valid) valid = !!monthly && parseFloat(monthly) > 0;
                            if (sameDueDate && valid) valid = !!startDate;

                            if (confirmBtn) confirmBtn.disabled = !valid;
                        };

                        ['fin-months', 'fin-monthly', 'fin-start'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) { el.addEventListener('input', checkFields); el.addEventListener('change', checkFields); }
                        });

                        setTimeout(checkFields, 50);
                    },
                    preConfirm: () => {
                        const sameAmount = (document.getElementById('fin-same-amount') as HTMLInputElement).checked;
                        const sameDueDate = (document.getElementById('fin-same-duedate') as HTMLInputElement).checked;
                        return {
                            months: parseInt((document.getElementById('fin-months') as HTMLInputElement).value),
                            monthly: sameAmount ? parseFloat((document.getElementById('fin-monthly') as HTMLInputElement).value) : 0,
                            startDate: sameDueDate ? (document.getElementById('fin-start') as HTMLInputElement).value : new Date().toISOString().split('T')[0],
                            sameAmount,
                            sameDueDate,
                            linkCommitment: (document.getElementById('fin-link-commitment') as HTMLInputElement).checked
                        };
                    }
                });

                if (step2.isDenied) { currentStep = 1; continue; } // Back → Step 1
                if (!step2.isConfirmed || !step2.value) return; // Cancel
                scheduleInfo = step2.value;
                currentStep = 3;
                continue;
            }

            // =============== STEP 3: Customize or Confirm ===============
            if (currentStep === 3) {
                const needsCustomization = !scheduleInfo.sameAmount || !scheduleInfo.sameDueDate;

                if (needsCustomization) {
                    // Build editable table with amount and/or date columns editable
                    const maxDisplay = Math.min(scheduleInfo.months, 120);
                    const defaultMonthly = scheduleInfo.monthly > 0 ? scheduleInfo.monthly : 0;
                    const defaultStartDate = scheduleInfo.startDate;

                    // Use previously customized data if going back then forward again
                    const hasExistingCustom = customInstallments.length === scheduleInfo.months;

                    let tableRows = '';
                    for (let i = 0; i < maxDisplay; i++) {
                        const existingAmt = hasExistingCustom ? customInstallments[i].amount : defaultMonthly;
                        let existingDate = '';
                        if (hasExistingCustom) {
                            existingDate = customInstallments[i].dueDate;
                        } else if (scheduleInfo.sameDueDate) {
                            const date = new Date(defaultStartDate);
                            date.setMonth(date.getMonth() + i);
                            existingDate = date.toISOString().split('T')[0];
                        } else {
                            existingDate = '';
                        }

                        const dueDateDisplay = existingDate
                            ? new Date(existingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '';

                        tableRows += `<tr>
                            <td class='text-center align-middle'>${i + 1}</td>`;

                        if (!scheduleInfo.sameDueDate) {
                            tableRows += `<td><input type='date' class='form-control form-control-sm inst-date' data-index='${i}' value='${existingDate}'></td>`;
                        } else {
                            tableRows += `<td class='text-center align-middle'><small>${dueDateDisplay}</small></td>`;
                        }

                        if (!scheduleInfo.sameAmount) {
                            tableRows += `<td><input type='number' class='form-control form-control-sm inst-amount' data-index='${i}' value='${existingAmt > 0 ? existingAmt.toFixed(2) : ''}'></td>`;
                        } else {
                            tableRows += `<td class='text-center align-middle'>MYR ${defaultMonthly.toFixed(2)}</td>`;
                        }

                        tableRows += `</tr>`;
                    }

                    // Build fill tools
                    let fillTools = '';
                    if (!scheduleInfo.sameAmount) {
                        fillTools = `
                            <div class='mb-3 d-flex gap-2 align-items-end'>
                                <div class='flex-grow-1'>
                                    <label class='form-label mb-1'><small>Fill amount</small></label>
                                    <div class='input-group input-group-sm'>
                                        <span class='input-group-text'>MYR</span>
                                        <input id='fill-amount' type='number' class='form-control' value='${defaultMonthly > 0 ? defaultMonthly.toFixed(2) : ''}'>
                                    </div>
                                </div>
                                <div>
                                    <label class='form-label mb-1'><small>From month #</small></label>
                                    <input id='fill-from' type='number' min='1' max='${maxDisplay}' class='form-control form-control-sm' value='1' style='width:70px'>
                                </div>
                                <button id='fill-btn' class='btn btn-sm btn-outline-primary' style='white-space:nowrap;height:31px'>Fill →</button>
                            </div>
                        `;
                    }

                    const step3 = await Swal.fire({
                        title: 'Add Financing — Step 3 of 3',
                        html: `
                            <div class='text-start'>
                                <p class='text-muted mb-2'><small>Customize ${!scheduleInfo.sameAmount && !scheduleInfo.sameDueDate ? 'amounts and due dates' : !scheduleInfo.sameAmount ? 'monthly amounts' : 'due dates'} for <strong>${basicInfo.name}</strong>.</small></p>
                                ${fillTools}
                                <div style='max-height:350px;overflow-y:auto;border:1px solid #dee2e6;border-radius:4px'>
                                    <table class='table table-sm table-striped mb-0'>
                                        <thead style='position:sticky;top:0;background:#f8f9fa;z-index:1'>
                                            <tr>
                                                <th class='text-center' style='width:50px'>#</th>
                                                <th class='text-center'>Due Date</th>
                                                <th>Amount (MYR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>${tableRows}</tbody>
                                    </table>
                                </div>
                                ${scheduleInfo.months > maxDisplay ? `<small class='text-warning'>Showing first ${maxDisplay} of ${scheduleInfo.months} months.</small>` : ''}
                            </div>
                        `,
                        width: '700px',
                        confirmButtonText: 'Create Financing',
                        confirmButtonColor: '#28a745',
                        showDenyButton: true,
                        denyButtonText: '← Back',
                        denyButtonColor: '#6c757d',
                        showCancelButton: true,
                        cancelButtonText: 'Cancel',
                        allowEscapeKey: false,
                        allowOutsideClick: false,
                        customClass: { actions: 'swal-wizard-actions' },
                        didOpen: () => {
                            // Setup money inputs
                            if (!scheduleInfo.sameAmount) {
                                const inputs = document.querySelectorAll('.inst-amount') as NodeListOf<HTMLInputElement>;
                                inputs.forEach(input => setupMoneyInput(input));

                                const fillAmtInput = document.getElementById('fill-amount') as HTMLInputElement;
                                if (fillAmtInput) setupMoneyInput(fillAmtInput);

                                const fillFromInput = document.getElementById('fill-from') as HTMLInputElement;
                                if (fillFromInput) setupWholeNumberInput(fillFromInput);

                                const fillBtn = document.getElementById('fill-btn');
                                fillBtn?.addEventListener('click', () => {
                                    const fillAmount = parseFloat((document.getElementById('fill-amount') as HTMLInputElement).value) || 0;
                                    const fillFrom = parseInt((document.getElementById('fill-from') as HTMLInputElement).value) || 1;
                                    const inputs = document.querySelectorAll('.inst-amount') as NodeListOf<HTMLInputElement>;
                                    inputs.forEach(input => {
                                        const idx = parseInt(input.getAttribute('data-index') || '0');
                                        if (idx >= fillFrom - 1) input.value = fillAmount.toFixed(2);
                                    });
                                });
                            }
                        },
                        preConfirm: () => {
                            const installments: { amount: number; dueDate: string }[] = [];
                            for (let i = 0; i < scheduleInfo.months; i++) {
                                let amount = scheduleInfo.monthly;
                                let dueDate = '';

                                if (!scheduleInfo.sameAmount && i < maxDisplay) {
                                    const amtInput = document.querySelector(`.inst-amount[data-index='${i}']`) as HTMLInputElement;
                                    amount = amtInput ? parseFloat(amtInput.value) || 0 : scheduleInfo.monthly;
                                }

                                if (!scheduleInfo.sameDueDate && i < maxDisplay) {
                                    const dateInput = document.querySelector(`.inst-date[data-index='${i}']`) as HTMLInputElement;
                                    dueDate = dateInput?.value || '';
                                } else {
                                    const date = new Date(scheduleInfo.startDate);
                                    date.setMonth(date.getMonth() + i);
                                    dueDate = date.toISOString().split('T')[0];
                                }

                                if (!dueDate) {
                                    Swal.showValidationMessage(`Due date for month ${i + 1} is required`);
                                    return false;
                                }

                                installments.push({ amount, dueDate });
                            }
                            return installments;
                        }
                    });

                    if (step3.isDenied) { currentStep = 2; continue; } // Back → Step 2
                    if (!step3.isConfirmed || !step3.value) return; // Cancel
                    customInstallments = step3.value;
                    break; // Done — proceed to submit

                } else {
                    // All same — show confirmation summary
                    const endDate = calculateEndDate(scheduleInfo.startDate, scheduleInfo.months);
                    const confirm = await Swal.fire({
                        title: 'Confirm Financing',
                        html: `
                            <div class='text-start'>
                                <table class='table table-bordered mb-0'>
                                    <tr><td class='text-muted'>Name</td><td><strong>${basicInfo.name}</strong></td></tr>
                                    ${basicInfo.provider ? `<tr><td class='text-muted'>Provider</td><td>${basicInfo.provider}</td></tr>` : ''}
                                    <tr><td class='text-muted'>Category</td><td>${CATEGORY_LABELS[basicInfo.category] || basicInfo.category}</td></tr>
                                    <tr><td class='text-muted'>Total Amount</td><td><strong>MYR ${basicInfo.total.toFixed(2)}</strong></td></tr>
                                    <tr><td class='text-muted'>Duration</td><td>${scheduleInfo.months} months</td></tr>
                                    <tr><td class='text-muted'>Monthly Payment</td><td>MYR ${scheduleInfo.monthly.toFixed(2)}</td></tr>
                                    <tr><td class='text-muted'>First Payment</td><td>${new Date(scheduleInfo.startDate).toLocaleDateString()}</td></tr>
                                    <tr><td class='text-muted'>Last Payment</td><td>${new Date(endDate).toLocaleDateString()}</td></tr>
                                    <tr><td class='text-muted'>Link to Commitment</td><td>${scheduleInfo.linkCommitment ? '✅ Yes' : '❌ No'}</td></tr>
                                </table>
                            </div>
                        `,
                        width: '600px',
                        confirmButtonText: 'Create Financing',
                        confirmButtonColor: '#28a745',
                        showDenyButton: true,
                        denyButtonText: '← Back',
                        denyButtonColor: '#6c757d',
                        showCancelButton: true,
                        cancelButtonText: 'Cancel',
                        allowEscapeKey: false,
                        allowOutsideClick: false,
                        customClass: { actions: 'swal-wizard-actions' },
                    });

                    if (confirm.isDenied) { currentStep = 2; continue; } // Back → Step 2
                    if (!confirm.isConfirmed) return; // Cancel

                    // Build uniform installments
                    customInstallments = [];
                    for (let i = 0; i < scheduleInfo.months; i++) {
                        const date = new Date(scheduleInfo.startDate);
                        date.setMonth(date.getMonth() + i);
                        customInstallments.push({
                            amount: scheduleInfo.monthly,
                            dueDate: date.toISOString().split('T')[0]
                        });
                    }
                    break; // Done — proceed to submit
                }
            }
        }

        // =============== Submit to API ===============
        try {
            Swal.fire({ title: 'Creating...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const actualMonthly = scheduleInfo.sameAmount ? scheduleInfo.monthly : customInstallments[0]?.amount || 0;
            const endDate = customInstallments.length > 0
                ? customInstallments[customInstallments.length - 1].dueDate
                : calculateEndDate(scheduleInfo.startDate, scheduleInfo.months);

            const planResponse = await fetch('/api/financing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    financing_name: basicInfo.name,
                    financing_provider: basicInfo.provider || null,
                    financing_category: basicInfo.category,
                    total_amount: basicInfo.total,
                    total_months: scheduleInfo.months,
                    monthly_amount_default: actualMonthly,
                    start_date: customInstallments[0]?.dueDate || scheduleInfo.startDate,
                    end_date: endDate,
                    notes: basicInfo.notes || null,
                    link_commitment: scheduleInfo.linkCommitment
                })
            });
            const planData = await planResponse.json();
            if (!planResponse.ok) throw new Error(planData.error || 'Failed to create financing plan');

            const installments = customInstallments.map((inst, i) => ({
                installment_number: i + 1,
                due_date: inst.dueDate,
                amount_due: inst.amount,
                notes: null
            }));

            const instResponse = await fetch('/api/financing-installments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ financing_id: planData.financing_id, installments })
            });
            if (!instResponse.ok) throw new Error('Failed to create installments');

            Swal.fire({
                icon: 'success',
                title: 'Financing Created!',
                html: `<strong>${basicInfo.name}</strong> with ${scheduleInfo.months} installments has been created.${scheduleInfo.linkCommitment ? '<br><small class="text-muted">A linked commitment was also created.</small>' : ''}`,
            });

            fetchPlans();
            fetchUpcoming();
        } catch (error) {
            Swal.fire('Error!', 'Failed to create financing plan', 'error');
        }
    };

    // ========== Edit Financing Plan ==========

    const editFinancing = async (plan: FinancingPlan) => {
        const isLinked = !!plan.linked_commitment_id;
        const escapedName = plan.financing_name.replace(/'/g, '&#39;');
        const escapedProvider = (plan.financing_provider || '').replace(/'/g, '&#39;');
        const escapedNotes = (plan.notes || '').replace(/'/g, '&#39;');

        const result = await Swal.fire({
            title: 'Edit Financing',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Financing Name <span class='text-danger'>*</span></label>
                        <input id='edit-fin-name' type='text' class='form-control' value='${escapedName}'>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Provider</label>
                        <input id='edit-fin-provider' type='text' class='form-control' value='${escapedProvider}'>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Category</label>
                        <select id='edit-fin-category' class='form-select'>
                            ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value='${k}' ${plan.financing_category === k ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Total Amount (MYR)</label>
                        <div class='input-group'>
                            <span class='input-group-text'>MYR</span>
                            <input id='edit-fin-total' type='number' class='form-control' value='${plan.total_amount.toFixed(2)}'>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Notes</label>
                        <textarea id='edit-fin-notes' class='form-control' rows='2'>${escapedNotes}</textarea>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Status</label>
                        <select id='edit-fin-status' class='form-select'>
                            <option value='active' ${plan.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value='completed' ${plan.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value='defaulted' ${plan.status === 'defaulted' ? 'selected' : ''}>Defaulted</option>
                        </select>
                    </div>
                    <div class='mb-4'>
                        <div class='form-check'>
                            <input class='form-check-input' type='checkbox' id='edit-fin-link'${isLinked ? ' checked' : ''}>
                            <label class='form-check-label' for='edit-fin-link'>
                                <strong>Link to Commitments Page</strong>
                            </label>
                        </div>
                        <small class='text-muted'>${isLinked
                            ? '✅ Currently linked — uncheck to remove from Commitments page'
                            : '❌ Not linked — check to show in Commitments page for monthly tracking'}</small>
                    </div>
                </div>
            `,
            width: '700px',
            confirmButtonText: 'Update',
            confirmButtonColor: '#28a745',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            didOpen: () => {
                const totalInput = document.getElementById('edit-fin-total') as HTMLInputElement;
                if (totalInput) setupMoneyInput(totalInput);

                const confirmBtn = Swal.getConfirmButton();
                if (confirmBtn) confirmBtn.disabled = false;

                const checkFields = () => {
                    const name = (document.getElementById('edit-fin-name') as HTMLInputElement)?.value?.trim();
                    const confirmBtn = Swal.getConfirmButton();
                    if (confirmBtn) confirmBtn.disabled = !name;
                };

                document.getElementById('edit-fin-name')?.addEventListener('input', checkFields);
            },
            preConfirm: () => {
                const linkChecked = (document.getElementById('edit-fin-link') as HTMLInputElement).checked;
                // Only send link_commitment if state changed
                let link_commitment: boolean | undefined = undefined;
                if (linkChecked && !isLinked) link_commitment = true;
                if (!linkChecked && isLinked) link_commitment = false;

                return {
                    financing_id: plan.financing_id,
                    financing_name: (document.getElementById('edit-fin-name') as HTMLInputElement).value.trim(),
                    financing_provider: (document.getElementById('edit-fin-provider') as HTMLInputElement).value.trim() || null,
                    financing_category: (document.getElementById('edit-fin-category') as HTMLSelectElement).value,
                    total_amount: parseFloat((document.getElementById('edit-fin-total') as HTMLInputElement).value) || plan.total_amount,
                    total_months: plan.total_months,
                    monthly_amount_default: plan.monthly_amount_default,
                    start_date: plan.start_date,
                    end_date: plan.end_date,
                    notes: (document.getElementById('edit-fin-notes') as HTMLTextAreaElement).value || null,
                    status: (document.getElementById('edit-fin-status') as HTMLSelectElement).value,
                    link_commitment,
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/financing', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });
                if (response.ok) {
                    Swal.fire('Success!', 'Financing plan updated', 'success');
                    fetchPlans();
                    fetchUpcoming();
                } else {
                    Swal.fire('Error!', 'Failed to update financing plan', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to update financing plan', 'error');
            }
        }
    };

    // ========== Delete Financing ==========

    const deleteFinancing = async (plan: FinancingPlan) => {
        const result = await Swal.fire({
            title: 'Delete Financing?',
            html: `Are you sure you want to delete <strong>"${plan.financing_name}"</strong>?<br>This will also delete all installment records${plan.linked_commitment_id ? ' and the linked commitment' : ''}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!',
            reverseButtons: true,
        });
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/financing?id=${plan.financing_id}`, { method: 'DELETE' });
                if (response.ok) {
                    Swal.fire('Deleted!', 'Financing plan has been deleted.', 'success');
                    fetchPlans();
                    fetchUpcoming();
                } else {
                    Swal.fire('Error!', 'Failed to delete financing plan', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete financing plan', 'error');
            }
        }
    };

    // ========== Table Columns ==========

    const upcomingColumns: TableColumnsType<Installment> = [
        {
            title: 'Name',
            key: 'name',
            render: (_, record) => (
                <div>
                    <strong>{record.financing_name}</strong>
                    {record.financing_provider && <small className='d-block text-muted'>{record.financing_provider}</small>}
                </div>
            )
        },
        {
            title: 'Due Date',
            dataIndex: 'due_date',
            key: 'due_date',
            render: (date) => new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        },
        {
            title: 'Amount (MYR)',
            dataIndex: 'amount_due',
            key: 'amount_due',
            render: (amount) => `MYR ${amount.toFixed(2)}`
        },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
                <Spin spinning={checkboxLoading === record.installment_id} size="small">
                    <Checkbox
                        checked={record.payment_status === 'paid'}
                        disabled={checkboxLoading === record.installment_id}
                        onChange={(e) => toggleInstallmentPaid(record, e.target.checked)}
                    >
                        {record.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </Checkbox>
                </Spin>
            )
        }
    ];

    const planColumns: TableColumnsType<FinancingPlan> = [
        {
            title: 'Name',
            key: 'name',
            width: isMobile ? 200 : undefined,
            render: (_, record) => (
                <div>
                    <div className='d-flex align-items-center gap-2'>
                        <strong>{record.financing_name}</strong>
                        {record.linked_commitment_id && (
                            <Tag color='blue' style={{ fontSize: '10px', lineHeight: '16px', padding: '0 4px', margin: 0 }}>🔗 Linked</Tag>
                        )}
                    </div>
                    {record.financing_provider && <small className='d-block text-muted'>{record.financing_provider}</small>}
                </div>
            )
        },
        {
            title: 'Category',
            dataIndex: 'financing_category',
            key: 'category',
            render: (cat) => <Tag color={CATEGORY_COLORS[cat] || '#8c8c8c'}>{CATEGORY_LABELS[cat] || cat}</Tag>
        },
        {
            title: 'Total (MYR)',
            dataIndex: 'total_amount',
            key: 'total_amount',
            render: (amount) => `MYR ${amount.toFixed(2)}`
        },
        {
            title: 'Monthly (MYR)',
            key: 'monthly',
            render: (_, record) => {
                const varying = hasVaryingAmounts(record);
                if (varying) {
                    const { min, max } = getAmountRange(record);
                    return (
                        <div>
                            <span>MYR {min.toFixed(2)} – MYR {max.toFixed(2)}</span>
                        </div>
                    );
                }
                return `MYR ${record.monthly_amount_default.toFixed(2)}`;
            }
        },
        {
            title: 'Progress',
            key: 'progress',
            width: 180,
            render: (_, record) => {
                const progress = getPlanProgress(record);
                return (
                    <div>
                        <Progress percent={progress.percent} size="small" status={progress.percent === 100 ? 'success' : 'active'} />
                        <small className='text-muted'>{progress.paid} / {progress.total} months</small>
                    </div>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const color = status === 'active' ? 'success' : status === 'completed' ? 'primary' : 'secondary';
                return <span className={`badge bg-${color}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <div className='d-flex gap-2'>
                    <Tooltip title="Edit">
                        <button className='btn btn-sm btn-primary' onClick={() => editFinancing(record)}>
                            <i className="bi bi-pencil"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <button className='btn btn-sm btn-danger' onClick={() => deleteFinancing(record)}>
                            <i className="bi bi-trash"></i>
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    const installmentColumns: TableColumnsType<Installment> = [
        {
            title: '#',
            dataIndex: 'installment_number',
            key: 'installment_number',
            width: 50,
        },
        {
            title: 'Due Date',
            dataIndex: 'due_date',
            key: 'due_date',
            render: (date) => new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        },
        {
            title: 'Amount Due',
            dataIndex: 'amount_due',
            key: 'amount_due',
            render: (amount) => `MYR ${amount.toFixed(2)}`
        },
        {
            title: 'Amount Paid',
            dataIndex: 'amount_paid',
            key: 'amount_paid',
            render: (amount) => amount > 0 ? `MYR ${amount.toFixed(2)}` : '-'
        },
        {
            title: 'Status',
            key: 'payment_status',
            render: (_, record) => {
                const isOverdue = record.payment_status === 'pending' && new Date(record.due_date) < new Date();
                return (
                    <Spin spinning={checkboxLoading === record.installment_id} size="small">
                        <Checkbox
                            checked={record.payment_status === 'paid'}
                            disabled={checkboxLoading === record.installment_id}
                            onChange={(e) => toggleInstallmentPaid(record, e.target.checked)}
                        >
                            {record.payment_status === 'paid' ? (
                                <span className='text-success'>Paid</span>
                            ) : isOverdue ? (
                                <span className='text-danger fw-bold'>Overdue</span>
                            ) : (
                                <span>Pending</span>
                            )}
                        </Checkbox>
                    </Spin>
                );
            }
        },
        {
            title: 'Paid Date',
            dataIndex: 'paid_date',
            key: 'paid_date',
            render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
            title: '',
            key: 'edit',
            width: 50,
            render: (_, record) => (
                <Tooltip title="Edit installment">
                    <button className='btn btn-sm btn-outline-secondary' onClick={() => editInstallmentAmount(record)}>
                        <i className="bi bi-pencil-square"></i>
                    </button>
                </Tooltip>
            )
        }
    ];

    // ========== Render ==========

    return (
        <div>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div className='d-flex align-items-center'>
                    <i className='bi bi-bank fs-3 text-secondary me-2 bi-title'></i>
                    <h3 className='text-secondary p-0 m-0'><strong>Financing Tracker</strong></h3>
                </div>
                <button className="btn btn-outline-secondary d-flex align-items-center" onClick={addFinancing}>
                    <i className="bi bi-plus-circle me-2"></i>
                    <span className='span-button'>Add Financing</span>
                </button>
            </div>

            <div className='border-bottom mb-3'></div>

            {/* Summary Cards */}
            <div className='row mb-3'>
                <div className='col-4 cancel-col'>
                    <div className='card bg-primary text-white'>
                        <div className='card-body'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <h6 className='mb-1'>Active Financings</h6>
                                    <h3 className='mb-0'>{activePlans.length}</h3>
                                    <small>financing plans</small>
                                </div>
                                <i className="bi bi-bank" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='col-4 cancel-col'>
                    <div className='card bg-danger text-white'>
                        <div className='card-body'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <h6 className='mb-1'>Total Outstanding</h6>
                                    <h3 className='mb-0'>MYR {activePlans.reduce((s, p) => s + p.total_amount, 0).toFixed(2)}</h3>
                                    <small>total to pay</small>
                                </div>
                                <i className="bi bi-graph-down-arrow" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='col-4 cancel-col'>
                    <div className='card bg-success text-white'>
                        <div className='card-body'>
                            <div className='d-flex justify-content-between align-items-center'>
                                <div>
                                    <h6 className='mb-1'>Monthly Payment</h6>
                                    <h3 className='mb-0'>MYR {activePlans.reduce((s, p) => s + p.monthly_amount_default, 0).toFixed(2)}</h3>
                                    <small>per month (default)</small>
                                </div>
                                <i className="bi bi-calendar-check" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Payments This Month */}
            <div className="mb-3">
                <div className="card">
                    <div className="card-header d-flex align-items-center p-3">
                        <i className="bi bi-clock-history me-2 text-secondary"></i>
                        <h5 className="fw-bold text-secondary p-0 m-0">Upcoming Payments — {monthNames[currentMonth]} {currentYear}</h5>
                    </div>
                    <div className="card-body p-3">
                        <Table
                            dataSource={upcomingInstallments}
                            columns={upcomingColumns}
                            rowKey="installment_id"
                            pagination={false}
                            scroll={{ x: isMobile ? 'max-content' : undefined }}
                            locale={{ emptyText: 'No payments due this month' }}
                        />
                    </div>
                </div>
            </div>

            {/* All Financing Plans */}
            <div className="mb-3">
                <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between p-3">
                        <div className="d-flex align-items-center">
                            <i className="bi bi-list-check me-2 text-secondary"></i>
                            <h5 className="fw-bold text-secondary p-0 m-0">All Financing Plans</h5>
                        </div>
                        <Select
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ width: 150 }}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'active', label: 'Active' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'defaulted', label: 'Defaulted' }
                            ]}
                        />
                    </div>
                    <div className="card-body p-3">
                        <Table
                            dataSource={plans}
                            columns={planColumns}
                            loading={isLoading}
                            rowKey="financing_id"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: isMobile ? 'max-content' : undefined }}
                            expandable={{
                                expandedRowRender: (record) => {
                                    const installments = expandedInstallments[record.financing_id] || [];
                                    return (
                                        <div style={{ padding: '8px 0' }}>
                                            <Table
                                                dataSource={installments}
                                                columns={installmentColumns}
                                                rowKey="installment_id"
                                                pagination={{ pageSize: 12, size: 'small' }}
                                                size="small"
                                                scroll={{ x: isMobile ? 'max-content' : undefined }}
                                                loading={!expandedInstallments[record.financing_id]}
                                            />
                                        </div>
                                    );
                                },
                                onExpand: (expanded, record) => {
                                    if (expanded && !expandedInstallments[record.financing_id]) {
                                        fetchInstallments(record.financing_id);
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
