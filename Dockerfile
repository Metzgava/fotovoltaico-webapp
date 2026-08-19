FROM nginx:alpine
COPY index.html style.css app.js calc.js /usr/share/nginx/html/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=8080
EXPOSE 8080
