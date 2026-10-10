import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../utils/axios";

const BizContext = createContext();

export const useBiz = () => useContext(BizContext);

export const BizProvider = ({ children }) => {
    const [business, setBusiness] = useState(null);
    const [myRole, setMyRole] = useState(null);

    const loadBusiness = useCallback(async (bizId) => {
        try {
            const { data } = await api.get(`/biz/businesses/${bizId}`);
            setBusiness(data.business);
            setMyRole(data.myRole);
            return data;
        } catch {
            setBusiness(null);
            setMyRole(null);
            return null;
        }
    }, []);

    const clearBusiness = useCallback(() => {
        setBusiness(null);
        setMyRole(null);
    }, []);

    const canManage = ["owner", "admin", "manager"].includes(myRole);
    const canSell = ["owner", "admin", "manager", "cashier"].includes(myRole);
    const isOwnerOrAdmin = ["owner", "admin"].includes(myRole);

    return (
        <BizContext.Provider value={{ business, myRole, loadBusiness, clearBusiness, canManage, canSell, isOwnerOrAdmin }}>
            {children}
        </BizContext.Provider>
    );
};
