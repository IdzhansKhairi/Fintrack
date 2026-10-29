"use client";

import React from "react";
import { Button, ButtonProps } from "antd";

interface AddButtonProps extends ButtonProps {
    children: React.ReactNode;
}

export default function AddButton({
    children,
    icon = <i className="bi bi-plus-lg" style={{ fontSize: "0.85rem" }} />,
    className = "",
    ...props
}: AddButtonProps) {
    return (
        <Button
            className={`add-content-button ${className}`}
            icon={icon}
            {...props}
        >
            {children}
        </Button>
    );
}