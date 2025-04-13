// frontend/src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
// Импортируем изображение
import loginImage from "../assets/login-page.png";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("access_token", data.access_token);
        console.log(data.access_token);

        navigate("/profile"); // Перенаправление на страницу профиля
      } else {
        alert(data.msg || "Login failed");
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  return (
    <div className="container my-5">
      <div className="card">
        <div className="row g-0">
          <div className="col-md-6">
            <img 
              src={loginImage} 
              alt="login form" 
              className="rounded-start w-100"
            />
          </div>
          <div className="col-md-6">
            <div className="card-body d-flex flex-column">
              
              <h5 className="fw-normal my-4 pb-3" style={{letterSpacing: '1px'}}>
                Sign into your account
              </h5>
              
              <form onSubmit={handleSubmit}>
                <div className="form-outline mb-4">
                  <input 
                    type="text" 
                    id="formControlLg" 
                    className="form-control form-control-lg"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <label className="form-label" htmlFor="formControlLg">Username</label>
                </div>
                
                <div className="form-outline mb-4">
                  <input 
                    type="password" 
                    id="formControlLg2" 
                    className="form-control form-control-lg"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <label className="form-label" htmlFor="formControlLg2">Password</label>
                </div>
                
                <button 
                  type="submit" 
                  className="btn btn-dark btn-lg mb-4 px-5"
                >
                  Login
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;