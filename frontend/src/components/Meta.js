import React from "react";
import { Helmet } from "react-helmet";

const Meta = ({ title, description, keywords }) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keyword" content={keywords} />
      <meta name="icon" href="/frontend/public/creative.jpg"/>
    </Helmet>
  );
};

Meta.defaultProps = {
  title: "Creative Duo Shop",
  keywords: "Custom, Custom Made Products, Small Buissness",
  description:
    "Creative Duo Focuses On Making The Best Possible Custom Product Wether It May Be Digital Or Physical. Get the best service ever. Help support our small buissness!",
};

export default Meta;