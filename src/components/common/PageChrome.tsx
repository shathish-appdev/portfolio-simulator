import { Block } from 'baseui/block';
import { HeadingSmall, ParagraphMedium } from 'baseui/typography';
import React from 'react';

/** Shared intro + max-width column for tab pages */
export function PageIntro({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Block maxWidth="960px" margin="0 auto" marginBottom="scale500">
      <HeadingSmall marginTop="0" marginBottom="scale300" $style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
        {title}
      </HeadingSmall>
      <ParagraphMedium color="contentSecondary" marginTop="0" marginBottom="0" $style={{ lineHeight: 1.55 }}>
        {children}
      </ParagraphMedium>
    </Block>
  );
}

/** Primary form / settings panel */
export function PageCard({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Block
      maxWidth="960px"
      margin="0 auto"
      padding="scale700"
      marginBottom="scale600"
      backgroundColor="backgroundPrimary"
      overrides={{
        Block: {
          style: ({ $theme }) => ({
            borderRadius: $theme.borders.radius300,
            border: `1px solid ${$theme.colors.borderOpaque}`,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04)',
          }),
        },
      }}
    >
      {children}
    </Block>
  );
}
