import React from 'react';
import { Block } from 'baseui/block';
import { Spinner } from 'baseui/spinner';
import { LabelMedium } from 'baseui/typography';

interface LoadingOverlayProps {
  active: boolean;
}

export function LoadingOverlay({ active }: LoadingOverlayProps): React.ReactElement | null {
  return (
  active ? (
    <Block
      position="absolute"
      top="0"
      left="0"
      width="100%"
      height="100%"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overrides={{
        Block: {
          style: {
            zIndex: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            pointerEvents: 'all'
          }
        }
      }}
    >
      <Block display="flex" flexDirection="column" alignItems="center" gridGap="scale400">
        <Spinner />
        <LabelMedium>Loading...</LabelMedium>
      </Block>
    </Block>
  ) : null
  );
} 