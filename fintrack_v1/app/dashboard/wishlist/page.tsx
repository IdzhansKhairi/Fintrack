"use client"

import React from 'react'
import Swal from 'sweetalert2';

import { useState, useEffect } from "react"
import { Table, Tooltip, Progress } from 'antd';
import type { TableColumnsType } from 'antd';
import { setupMoneyInput } from '@/lib/input-helpers';

interface WishlistItem {
    wishlist_id: number;
    wishlist_name: string;
    wishlist_category: string;
    wishlist_estimate_price: number | null;
    wishlist_final_price: number | null;
    wishlist_purchase_date: string | null;
    wishlist_url_link: string | null;
    wishlist_url_picture: string | null;
    wishlist_status: string;
}

export default function WishlistPage() {
    const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
    const [purchasedItems, setPurchasedItems] = useState<WishlistItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [savingsBalance, setSavingsBalance] = useState(0)
    const [isMobile, setIsMobile] = useState(false)

    const categories = ['Gunpla', 'Music', 'Climbing', 'Decoration', 'Technology', 'Others'];

    // Fetch savings balance from account_balance_table
    const fetchSavingsBalance = async () => {
        try {
            const response = await fetch('/api/accounts');
            const accounts = await response.json();
            const savingsAccount = accounts.find(
                (acc: any) => acc.account_category === 'Card' && acc.account_sub_category === 'Savings'
            );
            setSavingsBalance(savingsAccount ? savingsAccount.current_balance : 0);
        } catch (error) {
            console.error('Failed to fetch savings balance:', error);
        }
    };

    // Fetch wishlist items
    const fetchWishlistItems = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/wishlist?status=not_purchased');
            const data = await response.json();
            setWishlistItems(data);
        } catch (error) {
            console.error('Failed to fetch wishlist items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch purchased items
    const fetchPurchasedItems = async () => {
        try {
            const response = await fetch('/api/wishlist?status=purchased');
            const data = await response.json();
            setPurchasedItems(data);
        } catch (error) {
            console.error('Failed to fetch purchased items:', error);
        }
    };

    useEffect(() => {
        fetchWishlistItems();
        fetchPurchasedItems();
        fetchSavingsBalance();
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

    // Calculate progress percentage
    const getProgressPercentage = (estimatePrice: number | null): number => {
        if (!estimatePrice || estimatePrice === 0) return 0;
        const percentage = (savingsBalance / estimatePrice) * 100;
        return Math.min(percentage, 100); // Cap at 100%
    };

    // Get category badge color
    const getCategoryColor = (category: string): string => {
        const colors: Record<string, string> = {
            'Gunpla': 'primary',
            'Music': 'success',
            'Climbing': 'danger',
            'Decoration': 'warning',
            'Technology': 'info',
            'Others': 'secondary'
        };
        return colors[category] || 'secondary';
    };

    // View wishlist item details
    const viewWishlist = async (item: WishlistItem) => {
        const result = await Swal.fire({
            title: 'Wishlist Item Details',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Item Name</label>
                        <input id='view-wishlist-name' type='text' class='form-control' value='${item.wishlist_name}' disabled></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Category</label>
                        <select id='view-wishlist-category' class='form-select' disabled>
                            ${categories.map(c => `<option value='${c}' ${item.wishlist_category === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Estimated Price (MYR)</label>
                        <input id='view-wishlist-estimate-price' type='number' step='0.01' class='form-control' value='${item.wishlist_estimate_price?.toFixed(2) || ''}' disabled placeholder='0.00'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Product URL</label>
                        <input id='view-wishlist-url-link' type='url' class='form-control' value='${item.wishlist_url_link || ''}' disabled placeholder='https://...'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Image URL</label>
                        <input id='view-wishlist-url-picture' type='url' class='form-control' value='${item.wishlist_url_picture || ''}' disabled placeholder='https://...'></input>
                    </div>
                    ${item.wishlist_url_picture ? `
                        <div class='mb-4'>
                            <label class='form-label'>Product Image</label>
                            <div class='text-center'>
                                <img src='${item.wishlist_url_picture}' alt='${item.wishlist_name}' style='max-width: 100%; max-height: 300px; object-fit: contain;' />
                            </div>
                        </div>
                    ` : ''}
                </div>
            `,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: "Edit",
            confirmButtonColor: "#0d6efd",
            cancelButtonText: "Close",
            cancelButtonColor: "#6c757d",
        });

        if (result.isConfirmed) {
            editWishlist(item);
        }
    };

    // View purchased item details
    const viewPurchasedItem = async (item: WishlistItem) => {
        const result = await Swal.fire({
            title: 'Purchased Item Details',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Item Name</label>
                        <input type='text' class='form-control' value='${item.wishlist_name}' disabled></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Category</label>
                        <select class='form-select' disabled>
                            ${categories.map(c => `<option value='${c}' ${item.wishlist_category === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class='row'>
                        <div class='col-6 cancel-col mb-4 cancel-px'>
                            <label class='form-label'>Estimated Price (MYR)</label>
                            <input type='number' class='form-control' value='${item.wishlist_estimate_price?.toFixed(2) || ''}' disabled></input>
                        </div>
                        <div class='col-6 cancel-col mb-4 cancel-px'>
                            <label class='form-label'>Final Price (MYR)</label>
                            <input type='number' class='form-control' value='${item.wishlist_final_price?.toFixed(2) || ''}' disabled></input>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Purchase Date</label>
                        <input type='date' class='form-control' value='${item.wishlist_purchase_date || ''}' disabled></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Product URL</label>
                        <input type='url' class='form-control' value='${item.wishlist_url_link || ''}' disabled></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Image URL</label>
                        <input type='url' class='form-control' value='${item.wishlist_url_picture || ''}' disabled></input>
                    </div>
                    ${item.wishlist_url_picture ? `
                        <div class='mb-4'>
                            <label class='form-label'>Product Image</label>
                            <div class='text-center'>
                                <img src='${item.wishlist_url_picture}' alt='${item.wishlist_name}' style='max-width: 100%; max-height: 300px; object-fit: contain;' />
                            </div>
                        </div>
                    ` : ''}
                </div>
            `,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: "Edit",
            confirmButtonColor: "#0d6efd",
            cancelButtonText: "Close",
            cancelButtonColor: "#6c757d",
        });

        if (result.isConfirmed) {
            editWishlist(item);
        }
    };

    const addWishlist = async () => {
        const result = await Swal.fire({
            title: 'Add New Wishlist Item',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Item Name <span class='text-danger'>*</span></label>
                        <input id='wishlist-name' type='text' class='form-control' placeholder='Enter item name'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Category <span class='text-danger'>*</span></label>
                        <select id='wishlist-category' class='form-select'>
                            <option value='' disabled selected>Select category</option>
                            ${categories.map(c => `<option value='${c}'>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Estimated Price (MYR)</label>
                        <div class='input-group'>
                            <span class='input-group-text'>MYR</span>
                            <input id='wishlist-estimate-price' type='text' class='form-control' placeholder='0.00'></input>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Product URL</label>
                        <input id='wishlist-url-link' type='url' class='form-control' placeholder='https://...'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Image URL</label>
                        <input id='wishlist-url-picture' type='url' class='form-control' placeholder='https://...'></input>
                    </div>
                </div>
            `,
            width: '700px',
            focusConfirm: false,
            confirmButtonText: "Add to Wishlist",
            allowEscapeKey: false,
            allowOutsideClick: false,
            confirmButtonColor: "#28a745",
            showCancelButton: true,
            cancelButtonText: "Cancel",
            didOpen: () => {
                const priceInput = document.getElementById('wishlist-estimate-price') as HTMLInputElement;
                if (priceInput) setupMoneyInput(priceInput);
            },
            preConfirm: () => {
                const name = (document.getElementById('wishlist-name') as HTMLInputElement).value;
                const category = (document.getElementById('wishlist-category') as HTMLSelectElement).value;
                const estimatePrice = (document.getElementById('wishlist-estimate-price') as HTMLInputElement).value;
                const urlLink = (document.getElementById('wishlist-url-link') as HTMLInputElement).value;
                const urlPicture = (document.getElementById('wishlist-url-picture') as HTMLInputElement).value;

                if (!name || !category) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    wishlist_name: name,
                    wishlist_category: category,
                    wishlist_estimate_price: estimatePrice ? parseFloat(estimatePrice) : null,
                    wishlist_url_link: urlLink || null,
                    wishlist_url_picture: urlPicture || null,
                    wishlist_status: 'not_purchased'
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Wishlist item added successfully', 'success');
                    fetchWishlistItems();
                } else {
                    Swal.fire('Error!', 'Failed to add wishlist item', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to add wishlist item', 'error');
            }
        }
    }

    const editWishlist = async (item: WishlistItem) => {
        const result = await Swal.fire({
            title: 'Edit Wishlist Item',
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Item Name <span class='text-danger'>*</span></label>
                        <input id='edit-wishlist-name' type='text' class='form-control' value='${item.wishlist_name}' placeholder='Enter item name'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Category <span class='text-danger'>*</span></label>
                        <select id='edit-wishlist-category' class='form-select'>
                            ${categories.map(c => `<option value='${c}' ${item.wishlist_category === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Estimated Price (MYR)</label>
                        <div class='input-group'>
                            <span class='input-group-text'>MYR</span>
                            <input id='edit-wishlist-estimate-price' type='text' class='form-control' value='${item.wishlist_estimate_price ? item.wishlist_estimate_price.toFixed(2) : ''}' placeholder='0.00'></input>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Product URL</label>
                        <input id='edit-wishlist-url-link' type='url' class='form-control' value='${item.wishlist_url_link || ''}' placeholder='https://...'></input>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Image URL</label>
                        <input id='edit-wishlist-url-picture' type='url' class='form-control' value='${item.wishlist_url_picture || ''}' placeholder='https://...'></input>
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
                const priceInput = document.getElementById('edit-wishlist-estimate-price') as HTMLInputElement;
                if (priceInput) setupMoneyInput(priceInput);
            },
            preConfirm: () => {
                const name = (document.getElementById('edit-wishlist-name') as HTMLInputElement).value;
                const category = (document.getElementById('edit-wishlist-category') as HTMLSelectElement).value;
                const estimatePrice = (document.getElementById('edit-wishlist-estimate-price') as HTMLInputElement).value;
                const urlLink = (document.getElementById('edit-wishlist-url-link') as HTMLInputElement).value;
                const urlPicture = (document.getElementById('edit-wishlist-url-picture') as HTMLInputElement).value;

                if (!name || !category) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    wishlist_id: item.wishlist_id,
                    wishlist_name: name,
                    wishlist_category: category,
                    wishlist_estimate_price: estimatePrice ? parseFloat(estimatePrice) : null,
                    wishlist_final_price: item.wishlist_final_price,
                    wishlist_purchase_date: item.wishlist_purchase_date,
                    wishlist_url_link: urlLink || null,
                    wishlist_url_picture: urlPicture || null,
                    wishlist_status: item.wishlist_status
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/wishlist', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(result.value)
                });

                if (response.ok) {
                    Swal.fire('Success!', 'Wishlist item updated successfully', 'success');
                    if (item.wishlist_status === 'purchased') {
                        fetchPurchasedItems();
                    } else {
                        fetchWishlistItems();
                    }
                } else {
                    Swal.fire('Error!', 'Failed to update wishlist item', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to update wishlist item', 'error');
            }
        }
    }

    const deleteWishlist = async (wishlist_id: number, wishlist_name: string) => {
        const result = await Swal.fire({
            title: 'Delete Wishlist Item?',
            text: `Are you sure you want to delete "${wishlist_name}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/wishlist?id=${wishlist_id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    Swal.fire('Deleted!', 'Wishlist item has been deleted.', 'success');
                    fetchWishlistItems();
                    fetchPurchasedItems();
                } else {
                    Swal.fire('Error!', 'Failed to delete wishlist item', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete wishlist item', 'error');
            }
        }
    }

    const markAsPurchased = async (item: WishlistItem) => {
        const result = await Swal.fire({
            title: 'Mark as Purchased',
            html: `
                <div class='text-start'>
                    <p>Mark "${item.wishlist_name}" as purchased?</p>
                    <div class='mb-4'>
                        <label class='form-label'>Final Price (MYR) <span class='text-danger'>*</span></label>
                        <div class='input-group'>
                            <span class='input-group-text'>MYR</span>
                            <input id='final-price' type='text' class='form-control' value='${item.wishlist_estimate_price ? item.wishlist_estimate_price.toFixed(2) : ''}' placeholder='0.00'></input>
                        </div>
                    </div>
                    <div class='mb-4'>
                        <label class='form-label'>Purchase Date <span class='text-danger'>*</span></label>
                        <input id='purchase-date' type='date' class='form-control' value='${new Date().toISOString().split('T')[0]}'></input>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, mark as purchased!',
            cancelButtonText: 'Cancel',
            didOpen: () => {
                const priceInput = document.getElementById('final-price') as HTMLInputElement;
                if (priceInput) setupMoneyInput(priceInput);
            },
            preConfirm: () => {
                const finalPrice = (document.getElementById('final-price') as HTMLInputElement).value;
                const purchaseDate = (document.getElementById('purchase-date') as HTMLInputElement).value;

                if (!finalPrice || !purchaseDate) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                return {
                    finalPrice: parseFloat(finalPrice),
                    purchaseDate
                };
            }
        });

        if (result.isConfirmed && result.value) {
            try {
                const response = await fetch('/api/wishlist', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wishlist_id: item.wishlist_id,
                        wishlist_name: item.wishlist_name,
                        wishlist_category: item.wishlist_category,
                        wishlist_estimate_price: item.wishlist_estimate_price,
                        wishlist_final_price: result.value.finalPrice,
                        wishlist_purchase_date: result.value.purchaseDate,
                        wishlist_url_link: item.wishlist_url_link,
                        wishlist_url_picture: item.wishlist_url_picture,
                        wishlist_status: 'purchased'
                    })
                });

                if (response.ok) {
                    Swal.fire('Purchased!', 'Item marked as purchased', 'success');
                    fetchWishlistItems();
                    fetchPurchasedItems();
                } else {
                    Swal.fire('Error!', 'Failed to mark as purchased', 'error');
                }
            } catch (error) {
                Swal.fire('Error!', 'Failed to mark as purchased', 'error');
            }
        }
    }

    // Columns for wishlist table
    const wishlistColumns: TableColumnsType<WishlistItem> = [
        {
            title: 'Item Name',
            dataIndex: 'wishlist_name',
            key: 'wishlist_name',
        },
        {
            title: 'Category',
            dataIndex: 'wishlist_category',
            key: 'wishlist_category',
            render: (category) => (
                <span className={`badge bg-${getCategoryColor(category)}`}>
                    {category}
                </span>
            )
        },
        {
            title: 'Estimated Price (MYR)',
            dataIndex: 'wishlist_estimate_price',
            key: 'wishlist_estimate_price',
            render: (price) => price ? `MYR ${price.toFixed(2)}` : '-'
        },
        {
            title: 'Product URL',
            dataIndex: 'wishlist_url_link',
            key: 'wishlist_url_link',
            render: (url) => url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-link">
                    <i className="bi bi-link-45deg"></i> Link
                </a>
            ) : '-'
        },
        {
            title: 'Progress',
            key: 'progress',
            render: (_, record) => {
                const percentage = getProgressPercentage(record.wishlist_estimate_price);
                return record.wishlist_estimate_price ? (
                    <div style={{ width: '150px' }}>
                        <Progress
                            percent={Math.round(percentage)}
                            size="small"
                            status={percentage >= 100 ? 'success' : 'active'}
                        />
                    </div>
                ) : '-';
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <div className='d-flex gap-2'>
                    <Tooltip title="Mark as Purchased">
                        <button
                            className='btn btn-sm btn-success'
                            onClick={() => markAsPurchased(record)}
                        >
                            <i className="bi bi-check-circle"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="View">
                        <button
                            className='btn btn-sm btn-primary'
                            onClick={() => viewWishlist(record)}
                        >
                            <i className="bi bi-eye"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <button
                            className='btn btn-sm btn-danger'
                            onClick={() => deleteWishlist(record.wishlist_id, record.wishlist_name)}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    // Columns for purchased table
    const purchasedColumns: TableColumnsType<WishlistItem> = [
        {
            title: 'Item Name',
            dataIndex: 'wishlist_name',
            key: 'wishlist_name',
        },
        {
            title: 'Category',
            dataIndex: 'wishlist_category',
            key: 'wishlist_category',
            render: (category) => (
                <span className={`badge bg-${getCategoryColor(category)}`}>
                    {category}
                </span>
            )
        },
        {
            title: 'Final Price (MYR)',
            dataIndex: 'wishlist_final_price',
            key: 'wishlist_final_price',
            render: (price) => price ? `MYR ${price.toFixed(2)}` : '-'
        },
        {
            title: 'Purchase Date',
            dataIndex: 'wishlist_purchase_date',
            key: 'wishlist_purchase_date',
            render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
            title: 'Product URL',
            dataIndex: 'wishlist_url_link',
            key: 'wishlist_url_link',
            render: (url) => url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-link">
                    <i className="bi bi-link-45deg"></i> Link
                </a>
            ) : '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <div className='d-flex gap-2'>
                    <Tooltip title="View">
                        <button
                            className='btn btn-sm btn-primary'
                            onClick={() => viewPurchasedItem(record)}
                        >
                            <i className="bi bi-eye"></i>
                        </button>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <button
                            className='btn btn-sm btn-danger'
                            onClick={() => deleteWishlist(record.wishlist_id, record.wishlist_name)}
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
                    <i className='bi bi-gift fs-3 text-secondary me-2 bi-title'></i>
                    <h3 className='text-secondary p-0 m-0'><strong>Wishlists</strong></h3>
                </div>
                <button className="btn btn-outline-secondary d-flex align-items-center" onClick={addWishlist}>
                    <i className="bi bi-plus-circle me-2"></i>
                    <span>Add Wishlist</span>
                </button>
            </div>

            <div className='border-bottom mb-3'></div>

            {/* Savings Card */}
            <div className='card bg-success text-white mb-3'>
                <div className='card-body'>
                    <div className='d-flex justify-content-between align-items-center'>
                        <div>
                            <h6 className='mb-1'>Current Savings</h6>
                            <h3 className='mb-0'>MYR {savingsBalance.toFixed(2)}</h3>
                            <small>Available for wishlist purchases</small>
                        </div>
                        <i className="bi bi-piggy-bank" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                    </div>
                </div>
            </div>

            <div className='card mb-3'>
                <div className='card-header d-flex align-items-center justify-content-between p-3'>
                    <div className='d-flex align-items-center'>
                        <i className="bi bi-heart text-secondary fw-bold me-2"></i>
                        <h5 className="fw-bold text-secondary m-0 p-0">Wishlist</h5>
                    </div>
                </div>
                <div className='card-body p-3'>
                    <Table
                        dataSource={wishlistItems}
                        columns={wishlistColumns}
                        loading={isLoading}
                        rowKey="wishlist_id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: isMobile ? 'max-content' : undefined }}
                    />
                </div>
            </div>

            <div className='card'>
                <div className='card-header d-flex align-items-center justify-content-between p-3'>
                    <div className='d-flex align-items-center'>
                        <i className="bi bi-bag-check text-secondary fw-bold me-2"></i>
                        <h5 className="fw-bold text-secondary m-0 p-0">Purchased Wishlist</h5>
                    </div>
                </div>
                <div className='card-body p-3'>
                    <Table
                        dataSource={purchasedItems}
                        columns={purchasedColumns}
                        rowKey="wishlist_id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: isMobile ? 'max-content' : undefined }}
                    />
                </div>
            </div>
        </div>
    )

}
