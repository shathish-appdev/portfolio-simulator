import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Block } from "baseui/block";
import { useStyletron } from "baseui";

const TABS = [
  { path: "/lumpsum", label: "Lumpsum Simulator" },
  { path: "/sip", label: "SIP Simulator" },
  { path: "/historical", label: "Historical Values" },
  { path: "/stock-price", label: "Stock Price" },
] as const;

interface TabBarProps {
  onHelpClick: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onHelpClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [css, theme] = useStyletron();

  return (
    <Block
      display="flex"
      alignItems="center"
      gap="0"
      paddingTop="scale300"
      paddingBottom="scale300"
      overrides={{
        Block: {
          style: {
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            flexWrap: "wrap",
          },
        },
      }}
    >
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className={css({
              padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
              margin: 0,
              border: "none",
              background: isActive ? theme.colors.backgroundSecondary : "transparent",
              color: isActive ? theme.colors.contentPrimary : theme.colors.contentSecondary,
              fontSize: "14px",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              borderRadius: theme.borders.radius200,
              fontFamily: "inherit",
              ":hover": {
                background: theme.colors.backgroundSecondary,
                color: theme.colors.contentPrimary,
              },
            })}
          >
            {tab.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onHelpClick}
        className={css({
          padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
          margin: 0,
          marginLeft: "auto",
          border: "none",
          background: "transparent",
          color: theme.colors.contentSecondary,
          fontSize: "14px",
          cursor: "pointer",
          borderRadius: theme.borders.radius200,
          fontFamily: "inherit",
          ":hover": {
            background: theme.colors.backgroundSecondary,
            color: theme.colors.contentPrimary,
          },
        })}
      >
        Help
      </button>
    </Block>
  );
};
