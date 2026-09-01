"use client";

import React, { useState } from 'react';
import { Card, Button, Segmented, notification, Row, Col, Image, ConfigProvider } from 'antd';
import qrData from '@/public/qrcodes/qr-data.json';

type QRItem = {
  id: string;
  ownerName: string;
  accountHolderName: string;
  bank: string;
  accountNumber: string;
  imagePath: string;
};

export default function QRCodesPage() {
  const [activeTab, setActiveTab] = useState<string>('My QR');

  // Correct the image path from JSON to match actual public folder structure
  const getCorrectImagePath = (path: string) => {
    return path.replace('/qr/', '/qrcodes/');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    notification.success({
      message: 'Copied!',
      description: 'Account number copied to clipboard.',
      placement: 'bottomRight',
      duration: 3
    });
  };

  const handleDownload = (imagePath: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = getCorrectImagePath(imagePath);
    link.download = `${fileName}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentData = activeTab === 'My QR' ? qrData.myQR : qrData.othersQR;

  return (
    <div>
      {/* Page Title and Subtitle */}
      <div className="mb-4">
        <h1 className="page-title">Payment QR codes</h1>
        <p className="page-subtitle">Save your codes and the ones you pay often</p>
      </div>

      {/* Toggle */}
      <div className="mb-4">
        <ConfigProvider
          theme={{
            components: {
              Segmented: {
                borderRadius: 100,
              }
            }
          }}
        >
          <Segmented
            options={[
              { label: <span style={{ fontSize: '14px' }}>My QR</span>, value: 'My QR' },
              { label: <span style={{ fontSize: '14px' }}>Others' QR</span>, value: 'Others\' QR' }
            ]}
            value={activeTab}
            onChange={setActiveTab}
            size="large"
            style={{
              backgroundColor: 'rgba(116, 168, 132, 0.15)',
              color: '#1a2e23',
              fontWeight: 500,
              padding: '4px',
              borderRadius: '201px'
            }}
          />
        </ConfigProvider>
      </div>

      {/* Grid of QR Cards */}
      <Row gutter={[24, 24]}>
        {currentData.map((item: QRItem) => (
          <Col xs={24} sm={12} md={8} lg={8} xl={6} key={item.id}>
            <Card
              hoverable={false}
              bordered={false}
              style={{
                borderRadius: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
              bodyStyle={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {/* Card Header */}
              <div className="mb-3">
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1a2e23' }}>
                  {item.ownerName}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7f72' }}>
                  {item.bank}
                </div>
              </div>

              {/* QR Image */}
              <div className="text-center mb-4" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f9fbf5',
                  borderRadius: '12px',
                  display: 'inline-block'
                }}>
                  <Image
                    src={getCorrectImagePath(item.imagePath)}
                    alt={`${item.bank} QR`}
                    width={180}
                    height={180}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              </div>

              {/* Account Details */}
              <div className="mb-4">
                <div style={{ fontSize: '0.75rem', color: '#6b7f72', marginBottom: '2px' }}>
                  Account holder
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a402d', marginBottom: '12px' }}>
                  {item.accountHolderName}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#6b7f72', marginBottom: '2px' }}>
                  Account number
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a402d', letterSpacing: '1px' }}>
                  {item.accountNumber.match(/.{1,4}/g)?.join(' ') || item.accountNumber}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex gap-2 mt-auto">
                <Button
                  className="flex-grow-1"
                  icon={<i className="bi bi-copy" />}
                  onClick={() => handleCopy(item.accountNumber)}
                  style={{ borderRadius: '8px' }}
                >
                  Copy
                </Button>
                <Button
                  className="flex-grow-1"
                  icon={<i className="bi bi-download" />}
                  onClick={() => handleDownload(item.imagePath, item.id)}
                  style={{ borderRadius: '8px' }}
                >
                  Download
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}


