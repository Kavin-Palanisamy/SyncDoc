import React from 'react';
import { DividerNode } from '@syncdoc/shared';

interface DividerBlockProps {
  node: DividerNode;
}

export const DividerBlock: React.FC<DividerBlockProps> = () => {
  return (
    <div className="w-full py-2">
      <hr className="block-divider" />
    </div>
  );
};
