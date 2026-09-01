import { NextResponse } from "next/server";
import { WishlistAdapter } from "@/lib/db-adapter";

// GET - Fetch all wishlist items or filter by status
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        // Use WishlistAdapter to support dual database strategy
        const wishlistItems = await WishlistAdapter.getAll(status || undefined);

        return NextResponse.json(wishlistItems);
    } catch (error) {
        console.error('Failed to fetch wishlist:', error);
        return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
    }
}

// POST - Create a new wishlist item
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            wishlist_name,
            wishlist_category,
            wishlist_estimate_price,
            wishlist_final_price,
            wishlist_purchase_date,
            wishlist_url_link,
            wishlist_url_picture,
            wishlist_status
        } = body;

        // Round prices to 2 decimal places
        const roundedEstimate = wishlist_estimate_price ? parseFloat(Number(wishlist_estimate_price).toFixed(2)) : null;
        const roundedFinal = wishlist_final_price ? parseFloat(Number(wishlist_final_price).toFixed(2)) : null;

        // Use WishlistAdapter to support dual database strategy
        const newItem = await WishlistAdapter.create({
            wishlist_name,
            wishlist_category,
            wishlist_estimate_price: roundedEstimate,
            wishlist_final_price: roundedFinal,
            wishlist_purchase_date: wishlist_purchase_date || null,
            wishlist_url_link: wishlist_url_link || null,
            wishlist_url_picture: wishlist_url_picture || null,
            wishlist_status: wishlist_status || 'not_purchased'
        });

        return NextResponse.json({ success: true, wishlist_id: newItem.wishlist_id });
    } catch (error) {
        console.error('Failed to create wishlist item:', error);
        return NextResponse.json({ error: 'Failed to create wishlist item' }, { status: 500 });
    }
}

// PUT - Update an existing wishlist item
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            wishlist_id,
            wishlist_name,
            wishlist_category,
            wishlist_estimate_price,
            wishlist_final_price,
            wishlist_purchase_date,
            wishlist_url_link,
            wishlist_url_picture,
            wishlist_status
        } = body;

        // Round prices to 2 decimal places
        const roundedEstimate = wishlist_estimate_price ? parseFloat(Number(wishlist_estimate_price).toFixed(2)) : null;
        const roundedFinal = wishlist_final_price ? parseFloat(Number(wishlist_final_price).toFixed(2)) : null;

        // Use WishlistAdapter to support dual database strategy
        await WishlistAdapter.update(wishlist_id, {
            wishlist_name,
            wishlist_category,
            wishlist_estimate_price: roundedEstimate,
            wishlist_final_price: roundedFinal,
            wishlist_purchase_date: wishlist_purchase_date || null,
            wishlist_url_link: wishlist_url_link || null,
            wishlist_url_picture: wishlist_url_picture || null,
            wishlist_status
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update wishlist item:', error);
        return NextResponse.json({ error: 'Failed to update wishlist item' }, { status: 500 });
    }
}

// DELETE - Delete a wishlist item
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const wishlist_id = searchParams.get('id');

        if (!wishlist_id) {
            return NextResponse.json({ error: 'Wishlist ID required' }, { status: 400 });
        }

        // Use WishlistAdapter to support dual database strategy
        await WishlistAdapter.delete(parseInt(wishlist_id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete wishlist item:', error);
        return NextResponse.json({ error: 'Failed to delete wishlist item' }, { status: 500 });
    }
}
