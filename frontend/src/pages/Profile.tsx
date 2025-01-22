// frontend/src/pages/Profile.tsx
import React, { useEffect, useState } from "react";

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("access_token");
      const response = await fetch("/api/protected", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        // Обработка ошибок, например, перенаправление на логин
      }
    };

    fetchProfile();
  }, []);

  if (!profile) return <div>Loading...</div>;

  return (
    <div>
      <h1>Profile</h1>
      <p>Username: {profile.username}</p>
      <p>ID: {profile.id}</p>
      {/* Добавьте логаут */}
      <button
        onClick={() => {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default Profile;
