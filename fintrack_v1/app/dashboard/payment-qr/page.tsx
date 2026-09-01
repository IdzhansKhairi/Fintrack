"use client"

import React from 'react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Image from 'next/image';

import './paymentQr.css';

// Type for a single QR entry
interface QREntry {
    id: string;
    ownerName: string;
    accountHolderName?: string;
    bank: string;
    accountNumber: string;
    imagePath: string;
}

// Type for the full QR data JSON
interface QRData {
    myQR: QREntry[];
    othersQR: QREntry[];
}

export default function PaymentQRPage() {
    const [activeTab, setActiveTab] = useState<'my' | 'others'>('my');
    const [qrData, setQrData] = useState<QRData>({ myQR: [], othersQR: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

    // Fetch QR data from the static JSON file
    useEffect(() => {
        const fetchQRData = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/qr/qr-data.json');
                if (response.ok) {
                    const data: QRData = await response.json();
                    setQrData(data);
                } else {
                    console.error('Failed to load QR data:', response.status);
                }
            } catch (error) {
                console.error('Failed to fetch QR data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQRData();
    }, []);

    // Track images that failed to load
    const handleImageError = (id: string) => {
        setFailedImages(prev => new Set(prev).add(id));
    };

    // Get current QR list based on active tab
    const currentQRList = activeTab === 'my' ? qrData.myQR : qrData.othersQR;

    // Download QR image
    const downloadQRImage = async (qrEntry: QREntry) => {
        try {
            const response = await fetch(qrEntry.imagePath);
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Extract file extension from path, default to png
            const ext = qrEntry.imagePath.split('.').pop() || 'png';
            const sanitizedName = qrEntry.ownerName.replace(/[^a-zA-Z0-9]/g, '_');
            const sanitizedBank = qrEntry.bank.replace(/[^a-zA-Z0-9]/g, '_');
            link.download = `QR_${sanitizedName}_${sanitizedBank}.${ext}`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            Swal.fire({
                icon: 'error',
                title: 'Download Failed',
                text: 'Unable to download the QR image. The image file may not exist.',
                confirmButtonColor: '#dc3545',
            });
        }
    };

    // Copy text to clipboard using navigator API
    const copyToClipboard = async (text: string, buttonElement: HTMLButtonElement) => {
        try {
            await navigator.clipboard.writeText(text);
            
            buttonElement.classList.add('copied');
            
            // Revert after 2 seconds
            setTimeout(() => {
                buttonElement.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            buttonElement.classList.add('copy-failed');
            setTimeout(() => {
                buttonElement.classList.remove('copy-failed');
            }, 2000);
        }
    };

    // Open QR modal using SweetAlert2
    const openQRModal = (qrEntry: QREntry) => {
        const hasImage = !failedImages.has(qrEntry.id);
        const accountNumberHtml = qrEntry.accountNumber
            ? `  
                <div class='mb-3'>
                    <label class='form-label text-muted small mb-1'>Account Number</label>
                    <div class='d-flex align-items-center justify-content-center gap-2'>
                        <code class='fs-5 px-3 py-1' style="background-color: #f8f9fa; border-radius: 6px;">${qrEntry.accountNumber}</code>
                        <button type="button" class="btn btn-sm btn-outline-secondary copy-btn" data-clipboard-text="${qrEntry.accountNumber}">
                            <i class="bi bi-clipboard"></i>
                            <i class="bi bi-check-lg text-white"></i>
                            <i class="bi bi-x-lg text-white"></i>
                        </button>
                    </div>
                </div>
            `
            : '';

        const accountHolderHtml = qrEntry.accountHolderName
            ? `<div class='mb-3'>
                    <small class='text-muted'>Account Holder Name</small>
                    <p class='mb-0 fw-bold' style='font-size: 0.95rem;'>${qrEntry.accountHolderName}</p>
               </div>`
            : '';

        const imageHtml = hasImage
            ? `<div class='text-center mb-3'>
                    <img src='${qrEntry.imagePath}' alt='${qrEntry.ownerName} QR' style='max-width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px; border: 1px solid #e8e8e8;' />
               </div>`
            : `<div class='text-center mb-3 py-5' style='background-color: #f5f5f5; border-radius: 8px;'>
                    <i class='bi bi-qr-code' style='font-size: 4rem; color: #d9d9d9;'></i>
                    <p class='text-muted mt-2 mb-0'>QR image not available</p>
               </div>`;

        Swal.fire({
            title: qrEntry.ownerName,
            html: `
                <div class='text-center'>
                    <span class='badge bg-primary mb-3' style='font-size: 0.85rem;'>${qrEntry.bank}</span>
                </div>
                ${accountHolderHtml}
                ${imageHtml}
                ${accountNumberHtml}
            `,
            width: typeof window !== 'undefined' && window.innerWidth <= 768 ? '90vw' : '500px',
            showCancelButton: true,
            showConfirmButton: hasImage,
            confirmButtonText: '<i class="bi bi-download me-1"></i> Download QR',
            confirmButtonColor: '#0d6efd',
            cancelButtonText: 'Close',
            cancelButtonColor: '#6c757d',
            didOpen: () => {
                // Attach event listener for the copy button after modal renders
                const copyBtn = document.querySelector('.copy-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', (e) => {
                        const target = e.currentTarget as HTMLButtonElement;
                        const text = target.getAttribute('data-clipboard-text');
                        if (text) {
                            copyToClipboard(text, target);
                        }
                    });
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                downloadQRImage(qrEntry);
            }
        });
    };

    return (
        <div>
            {/* Page Header */}
            <div className='d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3'>
                <div className='d-flex align-items-center title-pages'>
                    <i className='bi bi-qr-code fs-3 text-secondary me-2 bi-title'></i>
                    <h3 className='text-secondary p-0 m-0'><strong>Payment QR</strong></h3>
                </div>

                {/* Toggle Buttons */}
                <div className="btn-group qr-toggle-buttons" role="group">
                    <button
                        type="button"
                        className={`btn ${activeTab === 'my' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('my')}
                    >
                        <i className="bi bi-person-fill me-1"></i>
                        My QR
                    </button>
                    <button
                        type="button"
                        className={`btn ${activeTab === 'others' ? 'btn-info text-white' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('others')}
                    >
                        <i className="bi bi-people-fill me-1"></i>
                        Others&apos; QR
                    </button>
                </div>
            </div>

            <div className='border-bottom my-3'></div>

            {/* Loading State */}
            {isLoading && (
                <div className="d-flex justify-content-center align-items-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && currentQRList.length === 0 && (
                <div className="qr-empty-state">
                    <i className="bi bi-qr-code"></i>
                    <p>No QR codes available in this category.</p>
                    <small className="text-muted mt-1">
                        Add QR images to <code>/public/qr/</code> and update <code>qr-data.json</code>
                    </small>
                </div>
            )}

            {/* QR Card Grid */}
            {!isLoading && currentQRList.length > 0 && (
                <div className="row g-3">
                    {currentQRList.map((qrEntry) => (
                        <div key={qrEntry.id} className="col-6 col-sm-4 col-md-3">
                            <div
                                className="qr-card"
                                onClick={() => openQRModal(qrEntry)}
                                title={`View ${qrEntry.ownerName}'s QR — ${qrEntry.bank}`}
                            >
                                {/* QR Image */}
                                {!failedImages.has(qrEntry.id) ? (
                                    <div className="qr-image-container">
                                        <Image
                                            src={qrEntry.imagePath}
                                            alt={`${qrEntry.ownerName} - ${qrEntry.bank}`}
                                            width={200}
                                            height={200}
                                            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                                            onError={() => handleImageError(qrEntry.id)}
                                            unoptimized
                                        />
                                    </div>
                                ) : (
                                    <div className="qr-image-placeholder">
                                        <i className="bi bi-qr-code"></i>
                                        <span>No Image</span>
                                    </div>
                                )}

                                {/* Card Info */}
                                <div className="qr-card-body">
                                    <p className="qr-owner-name">{qrEntry.ownerName}</p>
                                    <p className="qr-bank-name">
                                        <i className="bi bi-bank me-1"></i>
                                        {qrEntry.bank}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
