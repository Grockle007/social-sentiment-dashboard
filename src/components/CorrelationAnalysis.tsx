"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SP500Constituent } from '@/lib/api';

interface CorrelationAnalysisProps {
    currentStock: string;
    sp500List: SP500Constituent[];
}

export function CorrelationAnalysis({ currentStock, sp500List }: CorrelationAnalysisProps) {
    const [peers, setPeers] = useState<SP500Constituent[]>([]);
    const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
    const [correlation, setCorrelation] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!currentStock || sp500List.length === 0) return;

        const stockProfile = sp500List.find(s => s.symbol === currentStock);
        if (!stockProfile) return;

        // Find peers in the same sector
        const sectorPeers = sp500List
            .filter(s => s.sector === stockProfile.sector && s.symbol !== currentStock)
            .slice(0, 10); // Limit to 10 for UI

        setPeers(sectorPeers);
        setSelectedPeer(null);
        setCorrelation(null);
    }, [currentStock, sp500List]);

    const calculateCorrelation = async (peerSymbol: string) => {
        setSelectedPeer(peerSymbol);
        setLoading(true);
        setCorrelation(null);
        try {
            const res = await fetch(`/api/correlation?symbol1=${currentStock}&symbol2=${peerSymbol}`);
            const data = await res.json();
            if (data.correlation !== undefined) {
                setCorrelation(data.correlation);
            }
        } catch (error) {
            console.error("Failed to calculate correlation", error);
        } finally {
            setLoading(false);
        }
    };

    if (!currentStock) return null;

    return (
        <Card className="h-[600px] flex flex-col">
            <CardHeader>
                <CardTitle>Sector Correlation</CardTitle>
                <CardDescription>
                    Compare {currentStock} with peers in the same sector.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-4">
                <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Select a Peer</h4>
                    <div className="flex flex-wrap gap-2">
                        {peers.map((peer) => (
                            <Button
                                key={peer.symbol}
                                variant={selectedPeer === peer.symbol ? "default" : "outline"}
                                size="sm"
                                onClick={() => calculateCorrelation(peer.symbol)}
                            >
                                {peer.symbol}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-20 w-full" />
                    </div>
                ) : correlation !== null ? (
                    <div className="p-6 bg-secondary/50 rounded-xl text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Correlation Coefficient (90 Days)</div>
                        <div className={`text-4xl font-black ${correlation > 0.7 ? 'text-green-500' : correlation < -0.7 ? 'text-red-500' : 'text-yellow-500'}`}>
                            {correlation.toFixed(2)}
                        </div>
                        <Badge variant={correlation > 0.7 ? "default" : "secondary"}>
                            {correlation > 0.7 ? "High Positive" : correlation < -0.7 ? "High Inverse" : "Moderate/Low"}
                        </Badge>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-10 text-sm">
                        Select a peer to calculate correlation.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
