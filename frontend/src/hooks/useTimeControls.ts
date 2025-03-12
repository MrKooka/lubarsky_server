import React, { useState, useRef, useEffect } from "react";

function useTimeControls(videoRef) {
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    
    // Разделенное время для полей ввода
    const [startTimeValues, setStartTimeValues] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [endTimeValues, setEndTimeValues] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [isEditingStartTime, setIsEditingStartTime] = useState(false);
    const [isEditingEndTime, setIsEditingEndTime] = useState(false);
  
    // Утилиты для работы с временем
    const secondsToTime = (totalSeconds) => {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const milliseconds = Math.floor((totalSeconds % 1) * 1000);
  
      return { hours, minutes, seconds, milliseconds };
    };
  
    const timeToSeconds = (hours, minutes, seconds) => {
      return hours * 3600 + minutes * 60 + seconds;
    };
  
    const formatTime = (timeInSeconds) => {
      const time = secondsToTime(timeInSeconds);
      return `${time.hours.toString().padStart(2, "0")}:${time.minutes
        .toString().padStart(2, "0")}:${time.seconds
        .toString().padStart(2, "0")}.${time.milliseconds.toString().padStart(3, "0")}`;
    };
  
    // Обработчики событий
    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        const videoDuration = videoRef.current.duration;
        setDuration(videoDuration);
        setEndTime(videoDuration);
  
        const timeValues = secondsToTime(videoDuration);
        setEndTimeValues({
          hours: timeValues.hours,
          minutes: timeValues.minutes,
          seconds: timeValues.seconds,
        });
      }
    };
  
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    };
  
    // Функции установки времени
    const setCurrentAsStartTime = () => {
      const newTime = currentTime;
      setStartTime(newTime);
      setStartTimeValues(secondsToTime(newTime));
      setIsEditingStartTime(true);
    };
  
    const setCurrentAsEndTime = () => {
      const newTime = currentTime;
      setEndTime(newTime);
      setEndTimeValues(secondsToTime(newTime));
      setIsEditingEndTime(true);
    };
  
    // Функции редактирования времени
    const handleStartTimeChange = (field, value) => {
      let newValue = parseInt(value, 10);
      if (isNaN(newValue) || newValue < 0) newValue = 0;
      if ((field === "minutes" || field === "seconds") && newValue > 59) newValue = 59;
  
      const newTimeValues = { ...startTimeValues, [field]: newValue };
      setStartTimeValues(newTimeValues);
      setStartTime(timeToSeconds(newTimeValues.hours, newTimeValues.minutes, newTimeValues.seconds));
    };
  
    const handleEndTimeChange = (field, value) => {
      let newValue = parseInt(value, 10);
      if (isNaN(newValue) || newValue < 0) newValue = 0;
      if ((field === "minutes" || field === "seconds") && newValue > 59) newValue = 59;
  
      const newTimeValues = { ...endTimeValues, [field]: newValue };
      setEndTimeValues(newTimeValues);
      setEndTime(timeToSeconds(newTimeValues.hours, newTimeValues.minutes, newTimeValues.seconds));
    };
  
    // Подтверждение времени
    const confirmStartTime = () => {
      if (startTime >= endTime) {
        alert("Start time must be before end time");
        return;
      }
      setIsEditingStartTime(false);
      if (videoRef.current) {
        videoRef.current.currentTime = startTime;
      }
    };
  
    const confirmEndTime = () => {
      if (endTime <= startTime) {
        alert("End time must be after start time");
        return;
      }
      setIsEditingEndTime(false);
      if (videoRef.current) {
        videoRef.current.currentTime = endTime;
      }
    };
  
    // Предпросмотр фрагмента
    const previewSegment = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = startTime;
        videoRef.current.play();
  
        const checkTimeInterval = setInterval(() => {
          if (videoRef.current && videoRef.current.currentTime >= endTime) {
            videoRef.current.pause();
            clearInterval(checkTimeInterval);
          }
        }, 10);
      }
    };
  
    return {
      startTime,
      endTime,
      currentTime,
      duration,
      startTimeValues,
      endTimeValues,
      isEditingStartTime,
      isEditingEndTime,
      formatTime,
      handleLoadedMetadata,
      handleTimeUpdate,
      setCurrentAsStartTime,
      setCurrentAsEndTime,
      handleStartTimeChange,
      handleEndTimeChange,
      confirmStartTime,
      confirmEndTime,
      previewSegment
    };
  }

export default useTimeControls;