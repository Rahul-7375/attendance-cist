
import React, { useState, useEffect } from 'react';
import QRCodeGenerator from './QRCodeGenerator.tsx';
import { SessionData } from '../types.ts';
import { XIcon } from './Icons.tsx';

interface FullScreenQRCodeProps {
    sessionData: SessionData;
    onClose: () => void;
}

const FullScreenQRCode: React.FC<FullScreenQRCodeProps> = ({ sessionData, onClose }) => {
    const [qrSize, setQrSize] = useState(300);

    useEffect(() => {
        const updateSize = () => {
            const width = window.innerWidth;
            if (width >= 1024) { // Desktop
                setQrSize(660);
            } else if (width >= 768) { // Tablet
                setQrSize(520);
            } else { // Mobile
                // Target 430px, but constrain to screen width minus padding (approx 48px total safety margin)
                // to prevent the modal from overflowing the viewport on smaller phones.
                const maxAvailableWidth = width - 48;
                setQrSize(Math.min(430, maxAvailableWidth));
            }
        };

        updateSize(); // Set initial size
        window.addEventListener('resize', updateSize); // Adjust on resize

        return () => window.removeEventListener('resize', updateSize); // Cleanup
    }, []);

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4"
            aria-modal="true"
            role="dialog"
        >
            <div className="relative bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
                <button 
                    onClick={onClose} 
                    className="absolute -top-4 -right-4 w-12 h-12 bg-gray-200 dark:bg-gray-700 hover:bg-red-500 text-gray-800 dark:text-white hover:text-white rounded-full flex items-center justify-center transition-colors shadow-lg z-10"
                    aria-label="Close QR Code"
                >
                    <XIcon className="w-7 h-7" />
                </button>
                
                <QRCodeGenerator sessionData={sessionData} size={qrSize} />
            </div>
        </div>
    );
};

export default FullScreenQRCode;
