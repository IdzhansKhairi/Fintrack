"use client";
import { Menu, ConfigProvider } from 'antd';
import type { MenuProps } from 'antd';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import './components.css';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems: MenuProps['items'] = [
    { key: '/dashboard', icon: <i className="bi bi-grid-1x2" />, label: 'Dashboard' },
    { key: '/accounts', icon: <i className="bi bi-wallet2" />, label: 'Accounts' },
    { key: '/transaction', icon: <i className="bi bi-arrow-left-right" />, label: 'Transactions' },
    { key: '/commitments', icon: <i className="bi bi-arrow-repeat" />, label: 'Commitments' },
    { key: '/financing', icon: <i className="bi bi-credit-card-2-front" />, label: 'Financing' },
    { key: '/debts', icon: <i className="bi bi-cash-coin" />, label: 'Debts' },
    { key: '/wishlist', icon: <i className="bi bi-heart" />, label: 'Wishlist' },
    { key: '/qrcodes', icon: <i className="bi bi-qr-code-scan" />, label: 'QR Codes' },
    { key: '/insights', icon: <i className="bi bi-pie-chart" />, label: 'Insights' },
    { key: '/tabung', icon: <i className="bi bi-piggy-bank" />, label: 'Tabung' },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    router.push(key);
  };

  return (
    <div className="sidebar" style={{ width: 260, height: '100vh', overflowY: 'auto' }}>
      {/* Logo Section */}
      <div className='px-3 py-4 border-bottom'>
        <Link href="/" className="d-flex align-items-end text-decoration-none">
          <Image
            src="/images/fintrack-logo.png"
            alt="Fintrack Logo"
            width={46}
            height={46}
            className="me-3 logo-img"
          />
          <div className="d-flex flex-column">
            <span className="fs-5 fw-bold logo-text lh-1">Fintrack</span>
            <span className="logo-subtext mt-1">Personal finance</span>
          </div>
        </Link>
      </div>

      {/* Navigation Menu */}
      <ConfigProvider
        theme={{
          components: {
            Menu: {
              darkItemBg: 'transparent',
              darkItemColor: '#dbe7da',
              darkItemHoverBg: 'rgba(10, 55, 35)',
              darkItemHoverColor: '#ffffff',
              darkItemSelectedBg: 'rgba(105, 169, 128)',
              darkItemSelectedColor: '#ffffff',
              darkSubMenuItemBg: 'transparent',
              itemBorderRadius: 12,
              itemHeight: 40,
              iconSize: 12,
              itemMarginInline: 12,
              itemMarginBlock: 6,
              itemPaddingInline: 16,
            },
          },
        }}
      >
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className='pt-4'
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
            fontWeight: 500,
            fontSize: '0.75rem',
          }}
        />
      </ConfigProvider>
    </div>
  );
}