import React from 'react';
import { Block } from 'baseui/block';
import { useStyletron } from 'baseui';
import { ParagraphSmall } from 'baseui/typography';

export const BottomBar: React.FC = () => {
  const [, theme] = useStyletron();

  return (
    <Block
      backgroundColor="backgroundPrimary"
      paddingTop="scale500"
      paddingRight="scale600"
      paddingBottom="scale500"
      paddingLeft="scale600"
      overrides={{
        Block: {
          style: {
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            marginTop: 'auto',
          },
        },
      }}
    >
      <ParagraphSmall
        marginTop="0"
        marginBottom="0"
        color="contentTertiary"
        $style={{ textAlign: 'center', fontSize: '12px' }}
      >
        Market data from Yahoo Finance · For education only, not financial advice
      </ParagraphSmall>
    </Block>
  );
};

