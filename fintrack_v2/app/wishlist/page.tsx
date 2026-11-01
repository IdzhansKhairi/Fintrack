"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Button } from "antd";
import AddButton from "@/components/AddButtton";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import { createClient } from "@/utils/supabase/client";

interface WishlistItem {
  wishlist_id: string;
  user_id: string;
  wishlist_name: string;
  wishlist_category: string;
  wishlist_estimated_price: number;
  product_link: string | null;
  image_url: string | null;
  is_purchased: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type PurchaseFilter = "all" | "not_purchased" | "purchased";

const WISHLIST_CATEGORIES = [
  "Electronics",
  "Gadgets",
  "Furniture",
  "Decoration",
  "Home & Appliances",
  "Travel",
  "Fashion",
  "Shoes & Accessories",
  "Hobby",
  "Photography",
  "Musical",
  "Arts & Crafts",
  "Events & Concerts",
  "Gaming",
  "Books & Education",
  "Sports & Fitness",
  "Beauty & Personal Care",
  "Automotive",
  "Gifts",
  "Others",
];

function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCentsInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  if (cents === 0) {
    return rawValue === "0" ? "0.00" : "";
  }
  return (cents / 100).toFixed(2);
}

function normalizeExternalUrl(url: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export default function WishlistPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Filter State (default: "all")
  const [statusFilter, setStatusFilter] = useState<PurchaseFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Add / Edit Modal State
  const [itemModalOpen, setItemModalOpen] = useState<boolean>(false);
  const [itemModalMode, setItemModalMode] = useState<"add" | "edit">("add");
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [itemName, setItemName] = useState<string>("");
  const [itemCategory, setItemCategory] = useState<string>("Electronics");
  const [itemPriceInput, setItemPriceInput] = useState<string>("");
  const [itemProductLink, setItemProductLink] = useState<string>("");
  const [itemImageUrl, setItemImageUrl] = useState<string>("");
  const [itemModalError, setItemModalError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState<boolean>(false);

  // Delete Modal State
  const [deletingItem, setDeletingItem] = useState<WishlistItem | null>(null);
  const [deletingLoading, setDeletingLoading] = useState<boolean>(false);

  // Bottom Toast Notification State
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<BottomToastType>("success");

  const showToast = useCallback(
    (message: string, type: BottomToastType = "success") => {
      setToastMessage(message);
      setToastType(type);
      setToastOpen(true);
    },
    []
  );

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setUserId(user.id);

      // Ensure user profile exists
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || null,
          preferred_name: user.user_metadata?.preferred_name || null,
        },
        { onConflict: "id" }
      );

      const { data, error } = await supabase
        .from("wishlist")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: WishlistItem[] = (data || []).map((row) => ({
        ...row,
        wishlist_estimated_price: Number(row.wishlist_estimated_price),
      }));

      setItems(mapped);
    } catch (err) {
      console.error("Failed to fetch wishlist:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Summary Card Metrics
  const {
    stillWantedCount,
    estimatedWantedCost,
    alreadyPurchasedCost,
    purchasedCount,
  } = useMemo(() => {
    let wantedCount = 0;
    let wantedSum = 0;
    let boughtSum = 0;
    let boughtCount = 0;

    items.forEach((item) => {
      if (item.is_purchased) {
        boughtCount += 1;
        boughtSum += item.wishlist_estimated_price;
      } else {
        wantedCount += 1;
        wantedSum += item.wishlist_estimated_price;
      }
    });

    return {
      stillWantedCount: wantedCount,
      estimatedWantedCost: wantedSum,
      alreadyPurchasedCost: boughtSum,
      purchasedCount: boughtCount,
    };
  }, [items]);

  // Filtered Wishlist Items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter === "not_purchased" && item.is_purchased) return false;
      if (statusFilter === "purchased" && !item.is_purchased) return false;

      if (categoryFilter !== "all" && item.wishlist_category !== categoryFilter) {
        return false;
      }

      if (query) {
        const matchName = item.wishlist_name.toLowerCase().includes(query);
        const matchCat = item.wishlist_category.toLowerCase().includes(query);
        if (!matchName && !matchCat) return false;
      }

      return true;
    });
  }, [items, statusFilter, categoryFilter, searchQuery]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setItemModalMode("add");
    setEditingItem(null);
    setItemName("");
    setItemCategory("Electronics");
    setItemPriceInput("");
    setItemProductLink("");
    setItemImageUrl("");
    setItemModalError(null);
    setItemModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: WishlistItem) => {
    setItemModalMode("edit");
    setEditingItem(item);
    setItemName(item.wishlist_name);
    setItemCategory(item.wishlist_category || "Electronics");
    setItemPriceInput(Number(item.wishlist_estimated_price).toFixed(2));
    setItemProductLink(item.product_link || "");
    setItemImageUrl(item.image_url || "");
    setItemModalError(null);
    setItemModalOpen(true);
  };

  // Save (Add or Edit) Wishlist Item
  const handleSaveItem = async () => {
    setItemModalError(null);

    if (!userId) {
      setItemModalError("You must be signed in to manage your wishlist.");
      return;
    }

    const trimmedName = itemName.trim();
    if (!trimmedName) {
      setItemModalError("Please enter an item name.");
      return;
    }

    if (!itemCategory) {
      setItemModalError("Please select a category.");
      return;
    }

    const parsedPrice = parseFloat(itemPriceInput);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setItemModalError("Please enter a valid estimated price greater than RM 0.00.");
      return;
    }

    const roundedPrice = Math.round(parsedPrice * 100) / 100;

    setSavingItem(true);
    try {
      if (itemModalMode === "add") {
        const { error } = await supabase.from("wishlist").insert({
          user_id: userId,
          wishlist_name: trimmedName,
          wishlist_category: itemCategory,
          wishlist_estimated_price: roundedPrice,
          product_link: itemProductLink.trim() || null,
          image_url: itemImageUrl.trim() || null,
          is_purchased: false,
          is_active: true,
        });

        if (error) throw error;
        showToast(`"${trimmedName}" added to wishlist`, "success");
      } else if (itemModalMode === "edit" && editingItem) {
        const { error } = await supabase
          .from("wishlist")
          .update({
            wishlist_name: trimmedName,
            wishlist_category: itemCategory,
            wishlist_estimated_price: roundedPrice,
            product_link: itemProductLink.trim() || null,
            image_url: itemImageUrl.trim() || null,
          })
          .eq("wishlist_id", editingItem.wishlist_id)
          .eq("user_id", userId);

        if (error) throw error;

        // Reset broken image cache in case the user updated the image URL
        setBrokenImages((prev) => {
          const next = { ...prev };
          delete next[editingItem.wishlist_id];
          return next;
        });
        showToast(`"${trimmedName}" updated`, "success");
      }

      setItemModalOpen(false);
      await fetchWishlist();
    } catch (err: any) {
      setItemModalError(err.message || "Failed to save wishlist item.");
    } finally {
      setSavingItem(false);
    }
  };

  // Toggle Purchased / Not Purchased
  const handleTogglePurchased = async (item: WishlistItem) => {
    if (!userId) return;
    const nextPurchased = !item.is_purchased;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((it) =>
        it.wishlist_id === item.wishlist_id
          ? { ...it, is_purchased: nextPurchased }
          : it
      )
    );

    showToast(
      `"${item.wishlist_name}" is marked as ${nextPurchased ? "purchased" : "not purchased"
      }`,
      nextPurchased ? "success" : "info"
    );

    try {
      const { error } = await supabase
        .from("wishlist")
        .update({ is_purchased: nextPurchased })
        .eq("wishlist_id", item.wishlist_id)
        .eq("user_id", userId);

      if (error) throw error;
    } catch (err) {
      console.error("Failed to update purchase status:", err);
      await fetchWishlist();
    }
  };

  // Confirm Soft Delete Item
  const handleConfirmDelete = async () => {
    if (!deletingItem || !userId) return;
    setDeletingLoading(true);
    const removedName = deletingItem.wishlist_name;

    try {
      const { error } = await supabase
        .from("wishlist")
        .update({ is_active: false })
        .eq("wishlist_id", deletingItem.wishlist_id)
        .eq("user_id", userId);

      if (error) throw error;

      setDeletingItem(null);
      showToast(`"${removedName}" removed from wishlist`, "danger");
      await fetchWishlist();
    } catch (err) {
      console.error("Failed to delete wishlist item:", err);
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div>
        {/* Header Row */}
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
          <div>
            <h1 className="page-title">Wishlist</h1>
            <p className="page-subtitle mb-3">
              Items you wish to buy or own — priced, linked and tracked
            </p>
          </div>
          <div className="pt-1">
            <AddButton onClick={handleOpenAddModal}>Add item</AddButton>
          </div>
        </div>

          {/* 3 Summary Cards */}
          <div className="row g-4 mb-4">
            <div className="col-12 col-md-4">
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "18px",
                  padding: "20px 24px",
                  border: "1px solid #eef2ed",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#6b7f72",
                    fontWeight: 500,
                    marginBottom: "6px",
                  }}
                >
                  Items still wanted
                </div>
                <div
                  style={{
                    fontSize: "1.55rem",
                    fontWeight: 700,
                    color: "#1a2e23",
                    lineHeight: 1.2,
                  }}
                >
                  {stillWantedCount}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "18px",
                  padding: "20px 24px",
                  border: "1px solid #eef2ed",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#6b7f72",
                    fontWeight: 500,
                    marginBottom: "6px",
                  }}
                >
                  Estimated cost
                </div>
                <div
                  style={{
                    fontSize: "1.55rem",
                    fontWeight: 700,
                    color: "#1a2e23",
                    lineHeight: 1.2,
                  }}
                >
                  RM {formatAmount(estimatedWantedCost)}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "18px",
                  padding: "20px 24px",
                  border: "1px solid #eef2ed",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#6b7f72",
                    fontWeight: 500,
                    marginBottom: "6px",
                  }}
                >
                  Already purchased
                </div>
                <div
                  style={{
                    fontSize: "1.55rem",
                    fontWeight: 700,
                    color: "#10b981",
                    lineHeight: 1.2,
                  }}
                >
                  RM {formatAmount(alreadyPurchasedCost)}
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "14px 18px",
              border: "1px solid #eef2ed",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
              marginBottom: "24px",
            }}
          >
            <div className="row g-3 align-items-center justify-content-between">
              {/* Status Filter Pill Tabs */}
              <div className="col-12 col-lg-auto">
                <div
                  className="d-inline-flex flex-wrap gap-1 p-1"
                  style={{
                    backgroundColor: "#f3f7f4",
                    borderRadius: "14px",
                    border: "1px solid #e4ece6",
                  }}
                >
                  {[
                    { key: "all" as PurchaseFilter, label: `All (${items.length})` },
                    {
                      key: "not_purchased" as PurchaseFilter,
                      label: `Not purchased yet (${stillWantedCount})`,
                    },
                    {
                      key: "purchased" as PurchaseFilter,
                      label: `Purchased already (${purchasedCount})`,
                    },
                  ].map((tab) => {
                    const active = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatusFilter(tab.key)}
                        style={{
                          border: "none",
                          borderRadius: "10px",
                          padding: "6px 14px",
                          fontSize: "0.8rem",
                          fontWeight: active ? 600 : 500,
                          backgroundColor: active ? "#69a980" : "transparent",
                          color: active ? "#fcf7dc" : "#4a5d52",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="col-12 col-lg-6">
                <div className="row g-2">
                  <div className="col-12 col-sm-7">
                    <div
                      className="fintrack-modal-input d-flex align-items-center"
                      style={{ gap: "10px", padding: "8px 14px" }}
                    >
                      <i
                        className="bi bi-search"
                        style={{
                          color: "#8b9d90",
                          fontSize: "0.85rem",
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search item or category"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          width: "100%",
                          fontSize: "0.84rem",
                          color: "#1a2e23",
                          padding: 0,
                        }}
                      />
                    </div>
                  </div>

                  <div className="col-12 col-sm-5">
                    <select
                      className="form-select fintrack-modal-input"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      style={{ fontSize: "0.84rem" }}
                    >
                      <option value="all">All categories</option>
                      {WISHLIST_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wishlist Cards Grid */}
          {loading ? (
            <div
              className="text-center py-5"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "18px",
                border: "1px solid #eef2ed",
                color: "#6b7f72",
                fontSize: "0.9rem",
              }}
            >
              Loading your wishlist...
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              className="text-center py-5 px-3"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "18px",
                border: "1px solid #eef2ed",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  backgroundColor: "#eff6f1",
                  color: "#69a980",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.35rem",
                  marginBottom: "12px",
                }}
              >
                <i className="bi bi-heart" />
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "4px" }}>
                {items.length === 0
                  ? "Your wishlist is empty"
                  : "No wishlist items match your filter"}
              </h3>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7f72",
                  marginBottom: 0,
                }}
              >
                {items.length === 0
                  ? 'Click "+ Add item" at the top right to start tracking items you wish to buy.'
                  : "Try switching the filter tab or clearing your search query."}
              </p>
            </div>
          ) : (
            <div className="row g-4">
              {filteredItems.map((item) => {
                const hasValidImage =
                  !!item.image_url && !brokenImages[item.wishlist_id];
                const externalHref = normalizeExternalUrl(item.product_link);

                return (
                  <div key={item.wishlist_id} className="col-12 col-md-6 col-lg-4">
                    <div
                      className="h-100 d-flex flex-column justify-content-between"
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "18px",
                        border: "1px solid #eef2ed",
                        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.03)",
                        overflow: "hidden",
                      }}
                    >
                      <div>
                        {/* Product Image Header */}
                        <div
                          style={{
                            height: "230px",
                            backgroundColor: "#f3f6f4",
                            position: "relative",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {hasValidImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url!}
                              alt={item.wishlist_name}
                              onError={() =>
                                setBrokenImages((prev) => ({
                                  ...prev,
                                  [item.wishlist_id]: true,
                                }))
                              }
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              className="d-flex flex-column align-items-center justify-content-center"
                              style={{ color: "#9db0a3" }}
                            >
                              <i
                                className="bi bi-image"
                                style={{ fontSize: "2.2rem", marginBottom: "4px" }}
                              />
                              <span style={{ fontSize: "0.75rem" }}>No image</span>
                            </div>
                          )}

                          {/* Purchased Pill Badge */}
                          {item.is_purchased && (
                            <span
                              style={{
                                position: "absolute",
                                top: "14px",
                                right: "14px",
                                backgroundColor: "#16a34a",
                                color: "#ffffff",
                                borderRadius: "50px",
                                padding: "4px 12px",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
                              }}
                            >
                              <i className="bi bi-check2" />
                              Purchased
                            </span>
                          )}
                        </div>

                        {/* Item Details */}
                        <div style={{ padding: "18px 20px 12px 20px" }}>
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                            <div
                              style={{
                                fontSize: "0.98rem",
                                fontWeight: 600,
                                color: "#1a2e23",
                                lineHeight: 1.35,
                              }}
                            >
                              {item.wishlist_name}
                            </div>

                            {externalHref && (
                              <a
                                href={externalHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open product link"
                                style={{
                                  color: "#6b7f72",
                                  fontSize: "0.9rem",
                                  lineHeight: 1,
                                  padding: "2px 4px",
                                  flexShrink: 0,
                                }}
                              >
                                <i className="bi bi-box-arrow-up-right" />
                              </a>
                            )}
                          </div>

                          {/* Category Badge */}
                          <div className="mb-2">
                            <span
                              style={{
                                backgroundColor: "#1e4db7",
                                color: "#ffffff",
                                borderRadius: "50px",
                                padding: "2px 10px",
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                display: "inline-block",
                              }}
                            >
                              {item.wishlist_category}
                            </span>
                          </div>

                          {/* Price */}
                          <div
                            style={{
                              fontSize: "1.12rem",
                              fontWeight: 700,
                              color: "#1a2e23",
                              marginTop: "6px",
                            }}
                          >
                            RM {formatAmount(item.wishlist_estimated_price)}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Action Buttons */}
                      <div style={{ padding: "0 20px 18px 20px" }}>
                        {/* Mark as purchased / not purchased button */}
                        <button
                          type="button"
                          onClick={() => handleTogglePurchased(item)}
                          style={{
                            width: "100%",
                            backgroundColor: item.is_purchased
                              ? "#d9f3e2"
                              : "#f9fbf5",
                            border: item.is_purchased
                              ? "1px solid #c3ebd0"
                              : "1px solid #e2ebe4",
                            borderRadius: "10px",
                            padding: "8px 12px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "#1a2e23",
                            cursor: "pointer",
                            marginBottom: "8px",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = item.is_purchased
                              ? "#c8ebd4"
                              : "#f0f4ec";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = item.is_purchased
                              ? "#d9f3e2"
                              : "#f9fbf5";
                          }}
                        >
                          {item.is_purchased
                            ? "Mark as not purchased"
                            : "Mark as purchased"}
                        </button>

                        {/* Edit & Delete Buttons */}
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            style={{
                              flex: 1,
                              backgroundColor: "#f9fbf5",
                              border: "1px solid #e2ebe4",
                              borderRadius: "10px",
                              padding: "7px 10px",
                              fontSize: "0.78rem",
                              fontWeight: 500,
                              color: "#1a2e23",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              transition: "background-color 0.15s ease",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = "#f0f4ec")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = "#f9fbf5")
                            }
                          >
                            <i className="bi bi-pencil" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingItem(item)}
                            style={{
                              flex: 1,
                              backgroundColor: "#f9fbf5",
                              border: "1px solid #e2ebe4",
                              borderRadius: "10px",
                              padding: "7px 10px",
                              fontSize: "0.78rem",
                              fontWeight: 500,
                              color: "#dc2626",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              transition: "background-color 0.15s ease",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = "#fef2f2")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = "#f9fbf5")
                            }
                          >
                            <i className="bi bi-trash3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* =========================================================
          MODAL 1: ADD / EDIT WISHLIST ITEM MODAL
         ========================================================= */}
          <Modal
            open={itemModalOpen}
            onCancel={() => {
              if (!savingItem) setItemModalOpen(false);
            }}
            footer={null}
            centered
            width={480}
            className="fintrack-modal"
            title={
              itemModalMode === "add"
                ? "Add wishlist item"
                : `Edit ${editingItem?.wishlist_name || "item"}`
            }
          >
            {itemModalError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  borderRadius: "10px",
                  padding: "9px 12px",
                  fontSize: "0.78rem",
                  marginBottom: "14px",
                  marginTop: "8px",
                }}
              >
                {itemModalError}
              </div>
            )}

            {/* Row 1: Item name */}
            <div className="mb-3 mt-2">
              <label className="fintrack-modal-label">Item name</label>
              <input
                type="text"
                className="form-control fintrack-modal-input"
                placeholder="Fujifilm X-T5 Camera"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>

            {/* Row 2: Category & Estimated price (RM) */}
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="fintrack-modal-label">Category</label>
                <select
                  className="form-select fintrack-modal-input"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                >
                  {WISHLIST_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6">
                <label className="fintrack-modal-label">Estimated price (RM)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-control fintrack-modal-input"
                  placeholder="0.00"
                  value={itemPriceInput}
                  onChange={(e) =>
                    setItemPriceInput(formatCentsInput(e.target.value))
                  }
                />
              </div>
            </div>

            {/* Row 3: Product link */}
            <div className="mb-3">
              <label className="fintrack-modal-label">Product link</label>
              <input
                type="text"
                className="form-control fintrack-modal-input"
                placeholder="https://..."
                value={itemProductLink}
                onChange={(e) => setItemProductLink(e.target.value)}
              />
            </div>

            {/* Row 4: Image URL */}
            <div className="mb-4">
              <label className="fintrack-modal-label">Image URL</label>
              <input
                type="text"
                className="form-control fintrack-modal-input"
                placeholder="https://..."
                value={itemImageUrl}
                onChange={(e) => setItemImageUrl(e.target.value)}
              />
            </div>

            {/* Modal Footer */}
            <div className="d-flex justify-content-end gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setItemModalOpen(false)}
                disabled={savingItem}
              >
                Cancel
              </Button>
              <Button
                className="fintrack-modal-primary-btn"
                onClick={handleSaveItem}
                loading={savingItem}
              >
                {itemModalMode === "add" ? "Add item" : "Save changes"}
              </Button>
            </div>
          </Modal>

          {/* =========================================================
          MODAL 2: DELETE CONFIRMATION MODAL
         ========================================================= */}
          <Modal
            open={!!deletingItem}
            onCancel={() => {
              if (!deletingLoading) setDeletingItem(null);
            }}
            footer={null}
            centered
            width={420}
            className="fintrack-modal"
            title={deletingItem ? `Delete "${deletingItem.wishlist_name}"?` : "Delete item?"}
          >
            {deletingItem && (
              <>
                <p
                  style={{
                    fontSize: "0.84rem",
                    color: "#546e5f",
                    marginTop: "6px",
                    marginBottom: "22px",
                    lineHeight: 1.55,
                  }}
                >
                  This removes the item (RM{" "}
                  {formatAmount(deletingItem.wishlist_estimated_price)}) from your
                  wishlist. This cannot be undone.
                </p>

                <div className="d-flex justify-content-end gap-2">
                  <Button
                    className="fintrack-modal-cancel-btn"
                    onClick={() => setDeletingItem(null)}
                    disabled={deletingLoading}
                  >
                    Keep it
                  </Button>
                  <Button
                    className="fintrack-modal-danger-btn"
                    onClick={handleConfirmDelete}
                    loading={deletingLoading}
                  >
                    Delete item
                  </Button>
                </div>
              </>
            )}
          </Modal>

          {/* Bottom Notification Toast */}
          <BottomToast
            open={toastOpen}
            message={toastMessage}
            type={toastType}
            onClose={() => setToastOpen(false)}
          />
        </div>
        );
}
