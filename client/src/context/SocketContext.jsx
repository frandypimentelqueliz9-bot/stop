import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // En producción usa el origen (mismo servidor), en desarrollo usa localhost:3000
        const socketURL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
        const newSocket = io(socketURL);

        newSocket.on('connect', () => {
            console.log('Cliente conectado a Socket.io');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Cliente desconectado');
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => newSocket.close();
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
