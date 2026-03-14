import React from 'react';
import { Block } from 'baseui/block';
import { useStyletron } from 'baseui';

export const BottomBar: React.FC = () => {
  const [, theme] = useStyletron();

  return (
    <Block
      backgroundColor="transparent"
      paddingTop="scale400"
      paddingRight="scale300"
      paddingBottom="scale400"
      paddingLeft="scale300"
      overrides={{
        Block: {
          style: {
            borderTop: `1px solid ${theme.colors.borderTransparent}`,
            marginTop: 'auto',
          },
        },
      }}
    />
  );
};

