import React, { useState, useEffect } from 'react';
import { Input } from 'baseui/input';
import { Block } from 'baseui/block';
import { Asset, YahooFinanceAsset } from '../../types/asset';
import { HelpButton } from '../help';

interface YahooFinanceSelectorProps {
  onSelect: (asset: Asset | null) => void;
  value?: Asset;
}

export const YahooFinanceSelector: React.FC<YahooFinanceSelectorProps> = ({
  onSelect,
  value
}) => {
  const [symbol, setSymbol] = useState('');

  useEffect(() => {
    if (value && value.type === 'yahoo_finance') {
      setSymbol(value.symbol);
    } else {
      setSymbol('');
    }
  }, [value]);

  const buildAsset = (sym: string): YahooFinanceAsset => ({
    type: 'yahoo_finance',
    id: sym,
    name: sym,
    symbol: sym,
    displayName: sym
  });

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newSymbol = e.target.value.toUpperCase();
    setSymbol(newSymbol);

    if (newSymbol.trim()) {
      onSelect(buildAsset(newSymbol.trim()));
    } else {
      onSelect(null);
    }
  };

  return (
    <Block display="flex" alignItems="center" $style={{ gap: '8px', minWidth: '400px', flexGrow: 1, flexShrink: 1 }}>
      <Input
        value={symbol}
        onChange={handleSymbolChange}
        placeholder="Stock symbol"
        size="compact"
        overrides={{
          Root: {
            style: {
              width: '100%',
              flexGrow: 1
            }
          },
          After: () => (
            <Block display="flex" alignItems="center" paddingRight="scale300">
              <HelpButton topic="yahoo-tickers" />
            </Block>
          )
        }}
      />
    </Block>
  );
}; 