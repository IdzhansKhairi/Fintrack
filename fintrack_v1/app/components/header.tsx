"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { useRouter } from "next/navigation"
import { useAuth } from "../contexts/AuthContext";
import type { MenuProps } from "antd";
import { Dropdown, Space } from "antd";
import { UserOutlined, SettingOutlined } from "@ant-design/icons";

import 'bootstrap/dist/css/bootstrap.min.css';
import 'antd/dist/reset.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@sweetalert2/theme-bootstrap-4/bootstrap-4.min.css';

import React from "react";
import Swal from 'sweetalert2';
import Image from 'next/image'
import Link from "next/link";

interface HeaderProps {
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
}

export default function header({ menuOpen, setMenuOpen }: HeaderProps) {

    const router = useRouter();
    const { user, logout, refreshSession } = useAuth();

    const username = user?.username || '';
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : user?.username || 'User';

    const userEmail = user?.email || '';
    const userPhoneNumber = user?.phone_number || '';

    const handleLogout = async () => {
        Swal.fire({
            icon: "warning",
            title: "Are you sure you want to log out?",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showDenyButton: true,
            confirmButtonText: "Yes",
            denyButtonText: "Keep me logged in"
        }).then(async (result) => {

            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Logging out...',
                    timer: 3000,
                    didOpen: async () => {
                        Swal.showLoading();
                    },
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false
                }).then(async (result) => {
                    // Clear the session and cookie
                    await logout();

                    Swal.fire({
                        icon: 'success',
                        title: 'Successfully logged out!',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        confirmButtonText: "OK",
                    }).then(() => {
                        // Clear browser history state to prevent back button access
                        if (window.history && window.history.pushState) {
                            window.history.pushState(null, '', '/login');
                            window.history.replaceState(null, '', '/login');
                        }
                    })
                })
            }
        })
    }

    const profileMenuOpen = async() => {
        const result = await Swal.fire({
            title: `${fullName}'s Profile`,
            allowOutsideClick: false,
            allowEscapeKey: false,
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Username</label>
                        <input class='form-control' value='${username}' disabled></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>First Name</label>
                        <input class='form-control' value='${firstName}' disabled></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>Last Name</label>
                        <input class='form-control' value='${lastName}' disabled></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>Email</label>
                        <input class='form-control' value='${userEmail}' disabled></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>Phone Number</label>
                        <input class='form-control' value='${userPhoneNumber}' disabled></input>
                    </div>
                </div>
            `,
            width: typeof window !== 'undefined' && window.innerWidth <= 768 ? '90vw' : '700px',
            showCancelButton: true,
            confirmButtonText: "Edit",
            confirmButtonColor: "#0d6efd",
            cancelButtonText: "Close",
            cancelButtonColor: "#6c757d",
        });

        if (result.isConfirmed) {
            editProfile();
        }
    }

    const editProfile = async() => {
        const result = await Swal.fire({
            title: `Edit Profile`,
            allowOutsideClick: false,
            allowEscapeKey: false,
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Username <span class='text-danger'>*</span></label>
                        <input id='edit-username' type='text' class='form-control' value='${username}'></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>First Name <span class='text-danger'>*</span></label>
                        <input id='edit-first-name' type='text' class='form-control' value='${firstName}'></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>Last Name <span class='text-danger'>*</span></label>
                        <input id='edit-last-name' type='text' class='form-control' value='${lastName}'></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>Email <span class='text-danger'>*</span></label>
                        <input id='edit-user-email' type='email' class='form-control' value='${userEmail}'></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>Phone Number <span class='text-danger'>*</span></label>
                        <input id='edit-user-phone' type='tel' class='form-control' value='${userPhoneNumber}'></input>
                    </div>
                </div>
            `,
            width: typeof window !== 'undefined' && window.innerWidth <= 768 ? '90vw' : '700px',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: "Save Changes",
            confirmButtonColor: "#28a745",
            denyButtonText: "Change Password",
            denyButtonColor: "#ffc107",
            cancelButtonText: "Cancel",
            cancelButtonColor: "#6c757d",
            preConfirm: () => {
                const username = (document.getElementById('edit-username') as HTMLInputElement).value.trim();
                const firstName = (document.getElementById('edit-first-name') as HTMLInputElement).value.trim();
                const lastName = (document.getElementById('edit-last-name') as HTMLInputElement).value.trim();
                const email = (document.getElementById('edit-user-email') as HTMLInputElement).value.trim();
                const phone = (document.getElementById('edit-user-phone') as HTMLInputElement).value.trim();


                if (!username || !firstName || !lastName || !email || !phone) {
                    Swal.showValidationMessage('Please fill in all required fields');
                    return false;
                }

                // Email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    Swal.showValidationMessage('Please enter a valid email address');
                    return false;
                }

                return {
                    username,
                    firstName,
                    lastName,
                    email,
                    phoneNumber: phone,
                };
            }
        });

        if (result.isConfirmed && result.value) {
            // Show loading
            Swal.fire({
                title: 'Updating Profile...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const response = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(result.value),
                });

                const data = await response.json();

                if (response.ok) {
                    // Refresh session to get updated user data
                    await refreshSession();

                    Swal.fire({
                        icon: 'success',
                        title: 'Profile Updated!',
                        text: 'Your profile has been updated successfully.',
                        confirmButtonColor: '#28a745',
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Update Failed',
                        text: data.error || 'Failed to update profile. Please try again.',
                        confirmButtonColor: '#dc3545',
                    });
                }
            } catch (error) {
                console.error('Profile update error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while updating your profile.',
                    confirmButtonColor: '#dc3545',
                });
            }
        } else if (result.isDenied) {
            // User clicked "Change Password" button
            changePassword();
        }
    }

    const changePassword = async() => {
        const result = await Swal.fire({
            title: 'Change Password',
            allowOutsideClick: false,
            allowEscapeKey: false,
            html: `
                <div class='text-start'>
                    <div class='mb-4'>
                        <label class='form-label'>Current Password <span class='text-danger'>*</span></label>
                        <input id='current-password' type='password' class='form-control' placeholder='Enter current password'></input>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>New Password <span class='text-danger'>*</span></label>
                        <input id='new-password' type='password' class='form-control' placeholder='Enter new password'></input>
                        <small class='text-muted'>At least 6 characters</small>
                    </div>

                    <div class='mb-4'>
                        <label class='form-label'>Confirm New Password <span class='text-danger'>*</span></label>
                        <input id='confirm-password' type='password' class='form-control' placeholder='Confirm new password'></input>
                    </div>
                </div>
            `,
            width: typeof window !== 'undefined' && window.innerWidth <= 768 ? '90vw' : '600px',
            showCancelButton: true,
            confirmButtonText: "Change Password",
            confirmButtonColor: "#ffc107",
            cancelButtonText: "Cancel",
            cancelButtonColor: "#6c757d",
            preConfirm: () => {
                const currentPassword = (document.getElementById('current-password') as HTMLInputElement).value;
                const newPassword = (document.getElementById('new-password') as HTMLInputElement).value;
                const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement).value;

                if (!currentPassword || !newPassword || !confirmPassword) {
                    Swal.showValidationMessage('Please fill in all fields');
                    return false;
                }

                if (newPassword.length < 6) {
                    Swal.showValidationMessage('New password must be at least 6 characters long');
                    return false;
                }

                if (newPassword !== confirmPassword) {
                    Swal.showValidationMessage('New passwords do not match');
                    return false;
                }

                return {
                    currentPassword,
                    newPassword,
                    confirmPassword,
                };
            }
        });

        if (result.isConfirmed && result.value) {
            // Show loading
            Swal.fire({
                title: 'Changing Password...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const response = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(result.value),
                });

                const data = await response.json();

                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Password Changed!',
                        text: 'Your password has been changed successfully.',
                        confirmButtonColor: '#28a745',
                    }).then(() => {
                        // Return to profile view
                        profileMenuOpen();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Change Failed',
                        text: data.error || 'Failed to change password. Please try again.',
                        confirmButtonColor: '#dc3545',
                    }).then(() => {
                        // Return to change password form
                        changePassword();
                    });
                }
            } catch (error) {
                console.error('Password change error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while changing your password.',
                    confirmButtonColor: '#dc3545',
                }).then(() => {
                    // Return to change password form
                    changePassword();
                });
            }
        }
    }
    
    // Menu items for the profile dropdown
    const profileMenuItems: MenuProps["items"] = [
        {
        key: "label",
        disabled: true,
        // Using a custom header label
        label: (
            <div className="small text-secondary">
            Signed in as <strong>{fullName}</strong>
            </div>
        ),
        },
        { type: "divider" },
        { key: "profile", label: "Profile", icon: <UserOutlined />},
        // { key: "settings", label: "Settings", icon: <SettingOutlined />},
        { type: "divider" },
        { key: "logout", label: <span className="text-danger">Log out</span>},
    ];

    // Handle dropdown item clicks
    const onProfileMenuClick: MenuProps["onClick"] = async (info) => {
        switch (info.key) {
        case "profile":
            profileMenuOpen()
            break;
        case "settings":
            router.push("/dashboard/settings");
            break;
        case "logout":
            await handleLogout();
            break;
        default:
            break;
        }
    };


    return (
        <div className="flex-grow-1">
            <div className="d-flex align-items-center justify-content-between p-3 background-color-header">

                <div className="d-flex align-items-center justify-content-center">

                    {/* <a className={`text-dark text-decoration-none p-1 me-3 menu-button ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)}> */}
                    <a className={`text-dark text-decoration-none p-1 mx-3 ms-2 menu-button ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)}>
                        <i className={`d-flex bi ${menuOpen ? "bi-x" : "bi-list"} text-white fs-3`} />
                    </a>

                    <div className="d-flex align-items-center ms-2">
                        <Link href="/dashboard">
                            <Image className="me-2 me-md-3" src="/images/finttrack_logo_3.png" alt="Example Logo" width={40} height={40}></Image>
                        </Link>
                        
                        <h5 className="text-white medium p-0 m-0 d-none d-sm-block"><strong>Financial Tracker</strong></h5>
                    </div>
                </div>

                <div className="d-flex align-items-center">
                    <Dropdown trigger={["click"]} placement="bottom" menu={{ items: profileMenuItems, onClick: onProfileMenuClick }}>
                        {/* Anchor wrapper required by AntD; prevent default navigation */}
                        <a className="text-dark text-decoration-none p-2 icon-link" onClick={(e) => e.preventDefault()}>
                        <Space>
                            <i className="d-flex bi bi-person-fill text-white fs-5" />
                        </Space>
                        </a>
                    </Dropdown>
                    <span className="text-white ms-2 d-none d-md-inline"><strong>{fullName}</strong></span>
                </div>


            </div>
        </div>
    )
}