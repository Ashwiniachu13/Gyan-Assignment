const express = require("express");
const bodyParser = require("body-parser");
const moment = require("moment");
const mysql = require('mysql');
const axios = require("axios");

const app = express();

const PORT = 3000;
const connection = mysql.createConnection({
    host: "localhost",
    database: "weather",
    user: "root",
    password: "achuachu"
});

app.use(bodyParser.json());

connection.connect((err) => {
  if (err) {
    console.error('Database connection failed');
    return;
  }
  console.log('Connected to database');
});

app.get('/', (req, res) => {
  let sql = "SELECT * FROM eventsweather";
  connection.query(sql, function (err, results) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.send(results);
    }
  });
});

app.post("/events/create", (req, res) => {
    const { eventName, cityName, date, time, latitude, longitude } = req.body;

    if ((!latitude && !longitude && !date)) {
      return res.status(400).json({ Error: "Enter latitude, longitude, and date" });
  
    }
    else if (latitude && !longitude && !date) {
      return res.status(400).json({ Error: "Enter longitude, and date" });
    }
    else if (!latitude && longitude && !date){
      return res.status(400).json({ Error: "Enter latitude, and date" });
    }
    else if (!latitude && !longitude && date){
      return res.status(400).json({ Error: "Enter latitude, and longitude" });
    }
    else if (!latitude && longitude && date) {
      return res.status(400).json({ Error: "Enter latitude" });
    } else if (latitude && !longitude && date) {
      return res.status(400).json({ Error: "Enter longitude" });
    } else if (latitude && longitude && !date) {
      return res.status(400).json({ Error: "Enter date" });
    }

    const sql = "INSERT INTO eventsweather (event_name, city_name, date, time, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)";
    connection.query(sql, [eventName, cityName, date, time, latitude, longitude], (err, result) => {
      if (err) {
        console.error('Error inserting data: ' + err.message);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
      console.log('Event created successfully');
      res.status(201).json({ message: "Event created successfully" });
    });
  });

app.post("/events/find", async (req, res) => {
  const {latitude,longitude,date}= req.body;
  if ((!latitude && !longitude && !date)) {
    return res.status(400).json({ Error: "Enter latitude, longitude, and date" });

  }
  else if (latitude && !longitude && !date) {
    return res.status(400).json({ Error: "Enter longitude, and date" });
  }
  else if (!latitude && longitude && !date){
    return res.status(400).json({ Error: "Enter latitude, and date" });
  }
  else if (!latitude && !longitude && date){
    return res.status(400).json({ Error: "Enter latitude, and longitude" });
  }
  else if (!latitude && longitude && date) {
    return res.status(400).json({ Error: "Enter latitude" });
  } else if (latitude && !longitude && date) {
    return res.status(400).json({ Error: "Enter longitude" });
  } else if (latitude && longitude && !date) {
    return res.status(400).json({ Error: "Enter date" });
  }
  const page = req.query.page || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  const endDate = moment(date).add(14, 'days').format('YYYY-MM-DD');
  console.log(endDate)

  try {
    const countSql = "SELECT COUNT(*) as totalEvents FROM eventsweather WHERE date BETWEEN ? AND DATE_ADD(?, INTERVAL 14 DAY)";
    connection.query(countSql, [date,date], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }
    
      const totalEvents = result[0].totalEvents;
      const totalPages = Math.ceil(totalEvents / limit);

      if (page > totalPages) {
        return res.status(404).json({ message: "Events not found" });
      }

      const sql = "SELECT * FROM eventsweather WHERE date BETWEEN ? AND DATE_ADD(?, INTERVAL 14 DAY) ORDER BY date LIMIT ? OFFSET ?";
      connection.query(sql, [date, date, limit, skip], async (err, events) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "Internal server error" });
          return;
        }
        

        const eventDetails = await Promise.all(
          events.map(async (event) => {
            try {
              const weatherCondition = await axios.get(`https://gg-backend-assignment.azurewebsites.net/api/Weather?code=KfQnTWHJbg1giyB_Q9Ih3Xu3L9QOBDTuU5zwqVikZepCAzFut3rqsg==&city=${encodeURIComponent(event.city_name)}&date=${event.date}`);
              const distanceResponse = await axios.get(`https://gg-backend-assignment.azurewebsites.net/api/Distance?code=IAKvV2EvJa6Z6dEIUqqd7yGAu7IZ8gaH-a0QO6btjRc1AzFu8Y3IcQ==&latitude1=${latitude}&longitude1=${longitude}&latitude2=${event.latitude}&longitude2=${event.longitude}`);

              const weatherData = weatherCondition.data;
              const weatherKey = Object.keys(weatherData)[0];
              const weather = weatherData[weatherKey];
              const distance = distanceResponse.data.distance;

              return {
                event_name: event.event_name,
                city_name: event.city_name,
                date: event.date,
                weather,
                distance_km: distance,
              };
            } catch (error) {
              console.error(error);
              return null;
            }
          })
        );
 const totalPages=5;
        const responseObj = {
          events: eventDetails.filter(event => event !== null),
          page,
          pageSize: limit,
          totalEvents,
          totalPages,
        };
        res.json(responseObj);
      });
    });
  } catch (error) {
    console.error("error", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});