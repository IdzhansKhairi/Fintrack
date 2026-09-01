import { NextResponse } from "next/server";
import { FinancingAdapter, CommitmentsAdapter } from "@/lib/db-adapter";

// GET - Fetch all financing plans or filter by status/category
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const category = searchParams.get('category');

        const filters: any = {};
        if (status) filters.status = status;
        if (category) filters.category = category;

        const plans = await FinancingAdapter.getAll(filters);

        return NextResponse.json(plans);
    } catch (error) {
        console.error('Failed to fetch financing plans:', error);
        return NextResponse.json({ error: 'Failed to fetch financing plans' }, { status: 500 });
    }
}

// POST - Create a new financing plan (with optional commitment linking)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            financing_name,
            financing_provider,
            financing_category,
            total_amount,
            total_months,
            monthly_amount_default,
            start_date,
            end_date,
            notes,
            link_commitment
        } = body;

        // Round amounts to 2 decimal places
        const roundedTotal = parseFloat(Number(total_amount).toFixed(2));
        const roundedMonthly = parseFloat(Number(monthly_amount_default).toFixed(2));

        let linked_commitment_id = null;

        // Auto-create linked commitment if requested (default: true)
        if (link_commitment !== false) {
            try {
                const commitment = await CommitmentsAdapter.create({
                    commitment_name: financing_name,
                    commitment_description: `Linked from Financing: ${financing_name}${financing_provider ? ` (${financing_provider})` : ''}`,
                    commitment_per_month: roundedMonthly,
                    commitment_per_year: roundedMonthly * 12,
                    commitment_notes: `Auto-created from Financing Tracker. Category: ${financing_category}`,
                    commitment_status: 'Active',
                    commitment_start_month: null,
                    commitment_start_year: null
                });
                linked_commitment_id = commitment.commitment_id;
            } catch (commitError) {
                console.error('Failed to create linked commitment:', commitError);
                // Continue without linking - don't fail the financing creation
            }
        }

        const newPlan = await FinancingAdapter.create({
            financing_name,
            financing_provider: financing_provider || null,
            financing_category,
            total_amount: roundedTotal,
            total_months,
            monthly_amount_default: roundedMonthly,
            start_date,
            end_date: end_date || null,
            notes: notes || null,
            status: 'active',
            linked_commitment_id
        });

        return NextResponse.json({
            success: true,
            financing_id: newPlan.financing_id,
            linked_commitment_id
        });
    } catch (error) {
        console.error('Failed to create financing plan:', error);
        return NextResponse.json({ error: 'Failed to create financing plan' }, { status: 500 });
    }
}

// PUT - Update an existing financing plan
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            financing_id,
            financing_name,
            financing_provider,
            financing_category,
            total_amount,
            total_months,
            monthly_amount_default,
            start_date,
            end_date,
            notes,
            status,
            link_commitment  // undefined = no change, true = link, false = unlink
        } = body;

        const roundedTotal = parseFloat(Number(total_amount).toFixed(2));
        const roundedMonthly = parseFloat(Number(monthly_amount_default).toFixed(2));

        // Get current plan state before update
        const currentPlan = await FinancingAdapter.getById(financing_id);

        await FinancingAdapter.update(financing_id, {
            financing_name,
            financing_provider: financing_provider || null,
            financing_category,
            total_amount: roundedTotal,
            total_months,
            monthly_amount_default: roundedMonthly,
            start_date,
            end_date: end_date || null,
            notes: notes || null,
            status
        });

        // Handle link/unlink commitment
        if (link_commitment === true && !currentPlan?.linked_commitment_id) {
            // Link: create a new commitment and link it
            try {
                const commitment = await CommitmentsAdapter.create({
                    commitment_name: financing_name,
                    commitment_description: `Linked from Financing: ${financing_name}${financing_provider ? ` (${financing_provider})` : ''}`,
                    commitment_per_month: roundedMonthly,
                    commitment_per_year: roundedMonthly * 12,
                    commitment_notes: `Auto-created from Financing Tracker. Category: ${financing_category}`,
                    commitment_status: 'Active',
                    commitment_start_month: null,
                    commitment_start_year: null
                });
                await FinancingAdapter.update(financing_id, {
                    linked_commitment_id: commitment.commitment_id
                });
            } catch (commitError) {
                console.error('Failed to create linked commitment:', commitError);
            }
        } else if (link_commitment === false && currentPlan?.linked_commitment_id) {
            // Unlink: delete the linked commitment and clear the reference
            try {
                await CommitmentsAdapter.delete(currentPlan.linked_commitment_id);
                await FinancingAdapter.update(financing_id, {
                    linked_commitment_id: null
                });
            } catch (commitError) {
                console.error('Failed to unlink commitment:', commitError);
            }
        }

        // If status changed to 'completed', auto-deactivate linked commitment
        if (status === 'completed') {
            const plan = await FinancingAdapter.getById(financing_id);
            if (plan?.linked_commitment_id) {
                try {
                    const commitment = await CommitmentsAdapter.getAll();
                    const linkedCommitment = commitment.find((c: any) => c.commitment_id === plan.linked_commitment_id);
                    if (linkedCommitment) {
                        await CommitmentsAdapter.update(plan.linked_commitment_id, {
                            ...linkedCommitment,
                            commitment_status: 'Inactive'
                        });
                    }
                } catch (commitError) {
                    console.error('Failed to deactivate linked commitment:', commitError);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update financing plan:', error);
        return NextResponse.json({ error: 'Failed to update financing plan' }, { status: 500 });
    }
}

// DELETE - Delete a financing plan (and its linked commitment)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const financing_id = searchParams.get('id');

        if (!financing_id) {
            return NextResponse.json({ error: 'Financing ID required' }, { status: 400 });
        }

        const id = parseInt(financing_id);

        // Get the plan to check for linked commitment
        const plan = await FinancingAdapter.getById(id);

        // Delete the financing plan (installments cascade-delete)
        await FinancingAdapter.delete(id);

        // Also delete the linked commitment if it exists
        if (plan?.linked_commitment_id) {
            try {
                await CommitmentsAdapter.delete(plan.linked_commitment_id);
            } catch (commitError) {
                console.error('Failed to delete linked commitment:', commitError);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete financing plan:', error);
        return NextResponse.json({ error: 'Failed to delete financing plan' }, { status: 500 });
    }
}
