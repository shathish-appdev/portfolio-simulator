import React from 'react';
import { Block } from 'baseui/block';

interface ContainerProps {
  children: React.ReactNode;
}

export function Container({ children }: ContainerProps): React.ReactElement {
  return (
    <Block
      width="100%"
      backgroundColor="backgroundSecondary"
      display="flex"
      flexDirection="column"
      minHeight="100vh"
    >
      {children}
    </Block>
  );
} 