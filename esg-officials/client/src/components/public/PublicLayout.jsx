import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

const PublicLayout = ({ children }) => {
  const { pathname, hash } = useLocation();

  // Scroll to hash or top on route change
  useEffect(() => {
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  // Scroll-reveal IntersectionObserver
  useEffect(() => {
    const revealEls = document.querySelectorAll(".reveal, .case-file");

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
      );

      revealEls.forEach((el) => io.observe(el));

      return () => io.disconnect();
    } else {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    }
  }, [pathname]);

  return (
    <div className="esg-public-site">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
};

export default PublicLayout;
